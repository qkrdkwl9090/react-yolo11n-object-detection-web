import type { ModelInfo } from '@/types/model';

const getBasePath = (): string => {
  if (import.meta.env.DEV) {
    return '';
  }
  return import.meta.env.BASE_URL || '/';
};

const BASE_PATH = getBasePath();

export const YOLO_MODELS: ModelInfo[] = [
  {
    id: 'yolo11n',
    name: 'YOLOv11n Detection',
    description: 'General object detection (80 classes)',
    file: `${BASE_PATH}models/yolo11n.onnx`,
    type: 'detection',
    inputShape: [1, 3, 640, 640],
    outputFormat: '[1, 84, 8400]', // 4 bbox + 80 classes
  },
  {
    id: 'yolo11n-seg',
    name: 'YOLOv11n Segmentation',
    description: 'Instance segmentation with masks',
    file: `${BASE_PATH}models/yolo11n-seg.onnx`,
    type: 'segmentation',
    inputShape: [1, 3, 640, 640],
    outputFormat: '[1, 116, 8400]', // 4 bbox + 80 classes + 32 mask
  },
  {
    id: 'yolo11n-pose',
    name: 'YOLOv11n Pose',
    description: 'Human pose estimation (17 keypoints)',
    file: '/models/yolo11n-pose.onnx',
    type: 'pose',
    inputShape: [1, 3, 640, 640],
    outputFormat: '[1, 56, 8400]', // 4 bbox + 1 conf + 17*3 keypoints
  },
];

// COCO Pose 스켈레톤 연결 정보
export const POSE_SKELETON_CONNECTIONS = [
  [16, 14],
  [14, 12],
  [17, 15],
  [15, 13],
  [12, 13], // 머리와 어깨
  [6, 12],
  [7, 13],
  [6, 7], // 어깨 연결
  [6, 8],
  [7, 9],
  [8, 10],
  [9, 11], // 팔
  [2, 3],
  [1, 2],
  [1, 3],
  [2, 4],
  [3, 5],
  [4, 6],
  [5, 7], // 얼굴과 상체
];
export const POSE_KEYPOINT_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
];

// 키포인트별 색상 (관절 부위별로 구분)
export const POSE_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FECA57', // 얼굴
  '#FF9FF3',
  '#54A0FF',
  '#5F27CD',
  '#00D2D3',
  '#FF9F43', // 상체
  '#FF6348',
  '#2ED573',
  '#3742FA',
  '#F8B500',
  '#A4B0BE', // 하체
  '#2F3542',
  '#57606F', // 발목
];

export const COCO_CLASSES = [
  'person',
  'bicycle',
  'car',
  'motorcycle',
  'airplane',
  'bus',
  'train',
  'truck',
  'boat',
  'traffic light',
  'fire hydrant',
  'stop sign',
  'parking meter',
  'bench',
  'bird',
  'cat',
  'dog',
  'horse',
  'sheep',
  'cow',
  'elephant',
  'bear',
  'zebra',
  'giraffe',
  'backpack',
  'umbrella',
  'handbag',
  'tie',
  'suitcase',
  'frisbee',
  'skis',
  'snowboard',
  'sports ball',
  'kite',
  'baseball bat',
  'baseball glove',
  'skateboard',
  'surfboard',
  'tennis racket',
  'bottle',
  'wine glass',
  'cup',
  'fork',
  'knife',
  'spoon',
  'bowl',
  'banana',
  'apple',
  'sandwich',
  'orange',
  'broccoli',
  'carrot',
  'hot dog',
  'pizza',
  'donut',
  'cake',
  'chair',
  'couch',
  'potted plant',
  'bed',
  'dining table',
  'toilet',
  'tv',
  'laptop',
  'mouse',
  'remote',
  'keyboard',
  'cell phone',
  'microwave',
  'oven',
  'toaster',
  'sink',
  'refrigerator',
  'book',
  'clock',
  'vase',
  'scissors',
  'teddy bear',
  'hair drier',
  'toothbrush',
];
