import React, { useMemo } from 'react';
import { useLoader } from '@react-three/fiber';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import type { SVGResultPaths } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as THREE from 'three';

interface ShapeLayerProps {
  svgUrl: string;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  thickness: number;
  zOffset: number;
  position?: [number, number, number];
}

export const ShapeLayer: React.FC<ShapeLayerProps> = ({
  svgUrl,
  color,
  strokeColor,
  strokeWidth,
  thickness,
  zOffset,
  position = [0, 0, 0],
}) => {
  const svgData = useLoader(SVGLoader, svgUrl);

  const shapes = useMemo(() => {
    // 1. Collect all raw shapes
    const rawShapes: THREE.Shape[] = [];
    svgData.paths.forEach((path: SVGResultPaths) => {
      const pathShapes = SVGLoader.createShapes(path);
      rawShapes.push(...pathShapes);
    });

    // 2. Process holes
    const shapeInfos = rawShapes.map(shape => {
      const points = shape.getPoints();
      const area = THREE.ShapeUtils.area(points);
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });

      return {
        shape,
        area: Math.abs(area),
        bounds: { minX, minY, maxX, maxY },
        isHole: false,
      };
    });

    // Sort large to small
    shapeInfos.sort((a, b) => b.area - a.area);

    const finalShapes: THREE.Shape[] = [];

    // Nesting logic
    for (let i = 0; i < shapeInfos.length; i++) {
      const current = shapeInfos[i];
      
      // Check against larger shapes
      for (let j = i - 1; j >= 0; j--) {
        const potentialParent = shapeInfos[j];
        if (
          current.bounds.minX > potentialParent.bounds.minX &&
          current.bounds.maxX < potentialParent.bounds.maxX &&
          current.bounds.minY > potentialParent.bounds.minY &&
          current.bounds.maxY < potentialParent.bounds.maxY
        ) {
          potentialParent.shape.holes.push(current.shape);
          current.isHole = true;
          break; // Found the parent
        }
      }

      if (!current.isHole) {
        finalShapes.push(current.shape);
      }
    }

    return finalShapes;
  }, [svgData]);

  const extrudeSettings = useMemo(
    () => ({
      depth: thickness,
      bevelEnabled: false,
      curveSegments: 8, // Reduced from 24 - faster geometry creation
    }),
    [thickness]
  );

  return (
    <group position={position} scale={[1, -1, 1]}>
      {shapes.map((shape, i) => (
        <SingleShapeLayer 
            key={i} 
            shape={shape} 
            settings={extrudeSettings} 
            color={color} 
            strokeColor={strokeColor} 
            strokeWidth={strokeWidth} 
            zOffset={zOffset} 
        />
      ))}
    </group>
  );
};

// Extracted component to handle memoization of geometry per shape
const SingleShapeLayer: React.FC<{
    shape: THREE.Shape;
    settings: any;
    color: string;
    strokeColor: string;
    strokeWidth: number;
    zOffset: number;
}> = ({ shape, settings, color, strokeColor, strokeWidth, zOffset }) => {
    
    const geometry = useMemo(() => {
        return new THREE.ExtrudeGeometry(shape, settings);
    }, [shape, settings]);

    const edgesGeometry = useMemo(() => {
        // Threshold angle in degrees. 15 is standard for capturing 90deg edges.
        return new THREE.EdgesGeometry(geometry, 15);
    }, [geometry]);

    return (
        <group position={[0, 0, zOffset]}>
            <mesh geometry={geometry}>
                <meshStandardMaterial 
                    color={color} 
                    side={THREE.DoubleSide}
                    polygonOffset
                    polygonOffsetFactor={2}
                    polygonOffsetUnits={2}
                />
            </mesh>
            <lineSegments geometry={edgesGeometry} renderOrder={1}>
                <lineBasicMaterial color={strokeColor} linewidth={strokeWidth} />
            </lineSegments>
        </group>
    );
};
