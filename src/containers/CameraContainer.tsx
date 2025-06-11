import CameraView from '@/components/CameraView';
import useCamera from '@/hooks/useCamera';

const CameraContainer = () => {
  const {
    devices,
    selectedDeviceId,
    stream,
    isLoading,
    error,
    startCamera,
    refreshDevices,
  } = useCamera();

  const handleDeviceSelect = (deviceId: string) => {
    if (deviceId && deviceId !== selectedDeviceId) {
      startCamera(deviceId);
    }
  };

  return (
    <CameraView
      devices={devices}
      selectedDeviceId={selectedDeviceId}
      stream={stream}
      isLoading={isLoading}
      error={error}
      onDeviceSelect={handleDeviceSelect}
      onRefresh={refreshDevices}
    />
  );
};

CameraContainer.displayName = 'CameraContainer';
export default CameraContainer;
