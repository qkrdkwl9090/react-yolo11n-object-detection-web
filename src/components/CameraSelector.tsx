import { cn } from '@/lib/utils';
import type { MediaDeviceInfo } from '@/types/camera';
import { useEffect, useRef } from 'react';

interface CameraSelectorProps {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  onDeviceSelect: (deviceId: string) => void;
  onRefresh: () => void;
}

const CameraSelector = ({
  devices,
  selectedDeviceId,
  stream,
  isLoading,
  error,
  onDeviceSelect,
  onRefresh,
}: CameraSelectorProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // 비디오 스트림 연결
  useEffect(() => {
    if (videoRef.current && stream) {
      console.log('Setting video source to stream', stream);
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className='space-y-6'>
      {/* 카메라 선택 */}
      <div className='p-6'>
        <div className='mb-4 flex items-center justify-between'>
          <h2 className='text-xl font-semibold'>Camera Settings</h2>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={cn(
              'rounded bg-sky-900 p-2 text-sm',
              isLoading && 'cursor-not-allowed opacity-50'
            )}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className='mb-4 rounded-lg border border-red-700 bg-red-900/20 p-4'>
            <p className='text-sm text-red-300'>{error}</p>
          </div>
        )}

        <div className='flex justify-between'>
          <label className='text-sm font-medium text-gray-300'>
            Select Camera Device
          </label>
          <select
            value={selectedDeviceId || ''}
            onChange={e => onDeviceSelect(e.target.value)}
            disabled={isLoading || devices.length === 0}
            className='rounded-sm p-1 text-black'
          >
            <option value='' disabled>
              {devices.length === 0 ? 'No cameras found' : 'Select a camera'}
            </option>
            {devices.map(device => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
        </div>

        {devices.length === 0 && !isLoading && (
          <p className='mt-3 text-sm text-gray-400'>
            No camera devices found. Please connect a camera and refresh.
          </p>
        )}
      </div>
    </div>
  );
};

CameraSelector.displayName = 'CameraSelector';
export default CameraSelector;
