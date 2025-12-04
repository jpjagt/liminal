import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, OrbitControls, OrthographicCamera, Bounds, useBounds } from '@react-three/drei';
import { useControls, folder } from 'leva';
import { ShapeLayer } from './ShapeLayer';
import { SHAPES } from '../../lib/shapes';
import * as THREE from 'three';

export type IsoView = 'iso' | 'top' | 'left' | 'right';

interface IsoShapeProps {
  shapeId: string;
  enableControls?: boolean;
  view?: IsoView;
}

const VIEW_ROTATIONS: Record<IsoView, [number, number, number]> = {
  iso: [Math.atan(1 / Math.sqrt(2)), Math.PI / 4, 0], // True isometric: ~35.26 deg X, 45 deg Y
  top: [-Math.PI / 2, 0, 0], // Looking from top down (perpendicular to top face) // Wait, top face needs X rotation -90? Or 90?
  // Let's verify standard Three.js axes: Y is up, X right, Z forward.
  // Top view: Look down Y axis. Camera at (0, 100, 0), looking at (0,0,0).
  // Default camera looks down -Z.
  // To look down -Y, rotate X by -90 deg (-PI/2).
  left: [0, -Math.PI / 2, 0], // Look at left face (from -X direction?)
  // Front face is usually +Z. Right face +X. Left face -X.
  // "Left" typically means looking *at* the left side, so camera is at (-100, 0, 0).
  // Rotation: Y = -90 deg.
  right: [0, Math.PI / 2, 0], // Look at right face. Camera at (+100, 0, 0)?
  // Actually, standard front view looks at +Z face? No, usually +Z is "front" in 3D modeling terms for character.
  // Let's stick to: "Right" = look from right side (+X). Rot Y = 90.
  // "Left" = look from left side (-X). Rot Y = -90.
  // User asked for "perpendicular to each face".
};

// Animation component to fit bounds and animate entry
const ShapeContent: React.FC<{ 
    children: React.ReactNode; 
}> = ({ children }) => {
    const groupRef = useRef<THREE.Group>(null);
    const bounds = useBounds();
    const [animated, setAnimated] = useState(false);

    // Initial Fit
    useFrame(() => {
        if (!animated) {
            bounds.refresh(groupRef.current!).clip().fit();
            setAnimated(true);
        }
    });

    return (
        <group ref={groupRef}>
             {children}
        </group>
    );
}

// Wrapper to handle the scaling animation independent of Bounds calculation
const AnimatedWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const ref = useRef<THREE.Group>(null);
    const progress = useRef(0);

    useFrame((_, delta) => {
        if (ref.current && progress.current < 1) {
            progress.current += delta * 2; // Speed
            if (progress.current > 1) progress.current = 1;
            
            // Elastic/Overshoot ease or simple ease-out
            const t = progress.current;
            const ease = 1 - Math.pow(1 - t, 3); // Cubic ease out
            
            ref.current.scale.setScalar(ease);
        }
    });

    return <group ref={ref} scale={0}>{children}</group>;
}


const IsoShapeScene: React.FC<{ 
  shapeId: string; 
  enableControls: boolean;
  view: IsoView;
}> = ({ shapeId, enableControls, view }) => {
  const shapeConfig = SHAPES[shapeId];

  if (!shapeConfig) {
    return <group><text>Shape not found</text></group>;
  }

  // Define default values
  const defaultValues = {
    layerThickness: 1.3,
    fillColor: '#000000',
    strokeColor: '#ffffff',
    strokeWidth: 1,
    layerGap: 0,
    rotationX: VIEW_ROTATIONS[view][0] * (180/Math.PI), // Convert to degrees for controls if needed, but we override
    rotationY: VIEW_ROTATIONS[view][1] * (180/Math.PI),
    scale: 1,
  };

  // Leva Controls (conditionally enabled)
  const controls = useControls({
    Appearance: folder({
      layerThickness: { value: defaultValues.layerThickness, min: 0.1, max: 20 },
      fillColor: { value: defaultValues.fillColor },
      strokeColor: { value: defaultValues.strokeColor },
      strokeWidth: { value: defaultValues.strokeWidth, min: 0.1, max: 5 },
    }, { render: () => enableControls }), // Only render if enabled
    Layout: folder({
      layerGap: { value: defaultValues.layerGap, min: 0, max: 20 },
      scale: { value: defaultValues.scale, min: 0.1, max: 5 },
    }, { render: () => enableControls }),
    Camera: folder({
      rotationX: { value: defaultValues.rotationX, min: -360, max: 360 },
      rotationY: { value: defaultValues.rotationY, min: -360, max: 360 },
    }, { render: () => enableControls })
  }, { collapsed: true });

  // Use controls if enabled, otherwise defaults
  const {
      layerThickness,
      fillColor,
      strokeColor,
      strokeWidth,
      layerGap,
      rotationX,
      rotationY,
      scale
  } = enableControls ? controls : defaultValues;

  // If controls disabled, use the View prop for rotation
  const finalRotX = enableControls ? (rotationX * Math.PI / 180) : VIEW_ROTATIONS[view][0];
  const finalRotY = enableControls ? (rotationY * Math.PI / 180) : VIEW_ROTATIONS[view][1];

  return (
    <>
      <OrthographicCamera makeDefault position={[0, 0, 100]} zoom={40} />
      {enableControls && <OrbitControls enableZoom={true} makeDefault />}
      
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 10, 10]} intensity={1} />
      <directionalLight position={[-10, 10, -5]} intensity={0.5} />

      <Bounds fit clip observe margin={1.2}>
         <ShapeContent>
             <AnimatedWrapper>
                <Center>
                    <group rotation={[finalRotX, finalRotY, 0]} scale={scale}>
                    {shapeConfig.layers.map((layer, index) => (
                        <ShapeLayer
                        key={layer.id}
                        svgUrl={layer.svgPath}
                        color={fillColor}
                        strokeColor={strokeColor}
                        strokeWidth={strokeWidth}
                        thickness={layerThickness}
                        zOffset={index * (layerThickness + layerGap)}
                        />
                    ))}
                    </group>
                </Center>
            </AnimatedWrapper>
         </ShapeContent>
      </Bounds>
    </>
  );
};

export const IsoShape: React.FC<IsoShapeProps> = ({ 
    shapeId, 
    enableControls = false, 
    view = 'iso' 
}) => {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas>
        <Suspense fallback={null}>
          <IsoShapeScene 
            shapeId={shapeId} 
            enableControls={enableControls}
            view={view}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
