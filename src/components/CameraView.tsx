import { cn } from '@/lib/utils';
import type { MediaDeviceInfo } from '@/types/camera';
import { useEffect, useRef } from 'react';

interface CameraViewProps {
  devices: MediaDeviceInfo[];
  selectedDeviceId: string | null;
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  onDeviceSelect: (deviceId: string) => void;
  onRefresh: () => void;
}

const CameraView = ({
  devices,
  selectedDeviceId,
  stream,
  isLoading,
  error,
  onDeviceSelect,
  onRefresh,
}: CameraViewProps) => {
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

      {/* 비디오 스트림 */}
      <div className='p-6'>
        <h2 className='mb-4 text-xl font-semibold'>Live Camera Feed</h2>

        <div className='relative aspect-video overflow-hidden rounded-lg bg-gray-800'>
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className='h-full w-full object-cover'
            />
          ) : (
            <div className='absolute inset-0 flex items-center justify-center'>
              <div className='text-center'>
                <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-700'>
                  <svg
                    className='h-8 w-8 text-gray-500'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z'
                    />
                  </svg>
                </div>
                <p className='text-gray-400'>
                  {isLoading
                    ? 'Starting camera...'
                    : 'Select a camera to start'}
                </p>
              </div>
            </div>
          )}

          {/* 로딩 오버레이 */}
          {isLoading && (
            <div className='absolute inset-0 flex items-center justify-center bg-gray-900/75'>
              <div className='border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2'></div>
            </div>
          )}
        </div>

        {/* 비디오 정보 */}
        {stream && (
          <div className='mt-4 text-sm text-gray-400'>
            <p>
              Camera:{' '}
              {devices.find(d => d.deviceId === selectedDeviceId)?.label ||
                'Unknown'}
            </p>
            <p>
              Status: <span className='text-green-400'>Live</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

CameraView.displayName = 'CameraView';
export default CameraView;
