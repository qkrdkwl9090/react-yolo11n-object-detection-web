export interface MediaDeviceInfo {
  deviceId: string;
  kind: string;
  label: string;
  groupId: string;
}

export interface CameraState {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
}