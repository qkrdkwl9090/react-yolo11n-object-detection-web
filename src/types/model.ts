export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  file: string;
  type: 'detection' | 'segmentation' | 'pose';
  inputShape: [number, number, number, number]; // [batch, channels, height, width]
  outputFormat: string;
}

export interface ModelState {
  selectedModel: ModelInfo | null;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  session: any | null; // ort.InferenceSession
}

export interface Detection {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  confidence: number;
  classId: number;
  className: string;
}

export interface PoseKeypoint {
  x: number;
  y: number;
  confidence: number;
  visible: boolean;
}

export interface PoseResult extends Detection {
  keypoints: PoseKeypoint[];
}

export interface SegmentationResult extends Detection {
  mask?: ImageData;
}
export type InferenceResult = Detection | SegmentationResult | PoseResult;
