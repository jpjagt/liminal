export interface ShapeLayerConfig {
  id: string;
  svgPath: string;
  color: string;
  zOffset: number; // For stacking layers
}

export interface ShapeConfig {
  id: string;
  name: string;
  layers: ShapeLayerConfig[];
  defaultStrokeColor: string;
  defaultFillColor: string;
}

export const SHAPES: Record<string, ShapeConfig> = {
  mariposa: {
    id: 'mariposa',
    name: 'Mariposa',
    defaultStrokeColor: '#000000',
    defaultFillColor: '#ffffff',
    layers: [
      { id: 'layer-1', svgPath: '/shapes/mariposa/layer-1.svg', color: '#FF6B6B', zOffset: 0 },
      { id: 'layer-2', svgPath: '/shapes/mariposa/layer-2.svg', color: '#4ECDC4', zOffset: 12 },
      { id: 'layer-3', svgPath: '/shapes/mariposa/layer-3.svg', color: '#FFE66D', zOffset: 24 },
      { id: 'layer-4', svgPath: '/shapes/mariposa/layer-4.svg', color: '#1A535C', zOffset: 36 },
    ],
  },
  'starflower-pendant': {
    id: 'starflower-pendant',
    name: 'Starflower Pendant',
    defaultStrokeColor: '#000000',
    defaultFillColor: '#ffffff',
    layers: [
      { id: 'layer-1', svgPath: '/shapes/starflower-pendant/layer-1.svg', color: '#F7FFF7', zOffset: 0 },
      { id: 'layer-2', svgPath: '/shapes/starflower-pendant/layer-2.svg', color: '#4ECDC4', zOffset: 10 },
      { id: 'layer-3', svgPath: '/shapes/starflower-pendant/layer-3.svg', color: '#FFE66D', zOffset: 20 },
      { id: 'layer-4', svgPath: '/shapes/starflower-pendant/layer-4.svg', color: '#FF6B6B', zOffset: 30 },
    ],
  },
  'horned-circles': {
    id: 'horned-circles',
    name: 'Horned Circles',
    defaultStrokeColor: '#000000',
    defaultFillColor: '#ffffff',
    layers: [
      { id: 'layer-2', svgPath: '/shapes/horned-circles/layer-2.svg', color: '#264653', zOffset: 0 },
      { id: 'layer-3', svgPath: '/shapes/horned-circles/layer-3.svg', color: '#2A9D8F', zOffset: 10 },
      { id: 'layer-4', svgPath: '/shapes/horned-circles/layer-4.svg', color: '#E9C46A', zOffset: 20 },
      { id: 'layer-5', svgPath: '/shapes/horned-circles/layer-5.svg', color: '#F4A261', zOffset: 30 },
    ],
  },
};
