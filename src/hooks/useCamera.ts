import type { CameraState } from '@/types/camera';
import { useCallback, useEffect, useState } from 'react';

const useCamera = () => {
  const [state, setState] = useState<CameraState>({
    devices: [],
    selectedDeviceId: null,
    stream: null,
    isLoading: false,
    error: null,
  });

  // 카메라 디바이스 목록 가져오기
  const getDevices = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // 권한 요청
      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        device => device.kind === 'videoinput'
      );

      console.log('Found video devices:', videoDevices); // 디버깅용

      // 권한 요청용 스트림 정리
      permissionStream.getTracks().forEach(track => track.stop());

      setState(prev => ({
        ...prev,
        devices: videoDevices,
        isLoading: false,
      }));

      // 첫 번째 디바이스로 자동 시작
      if (videoDevices.length > 0) {
        await startCameraInternal(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Camera access error:', error); // 디버깅용
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Failed to access camera',
        isLoading: false,
      }));
    }
  }, []);

  // 내부 카메라 시작 함수
  const startCameraInternal = useCallback(async (deviceId: string) => {
    try {
      console.log('Starting camera with deviceId:', deviceId); // 디버깅용

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // 기존 스트림 정리
      setState(prev => {
        if (prev.stream) {
          prev.stream.getTracks().forEach(track => track.stop());
        }
        return prev;
      });

      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      console.log('Camera constraints:', constraints); // 디버깅용

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log('Camera stream created:', stream); // 디버깅용

      setState(prev => ({
        ...prev,
        stream,
        selectedDeviceId: deviceId,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Start camera error:', error); // 디버깅용
      setState(prev => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Failed to start camera',
        isLoading: false,
      }));
    }
  }, []);

  // 외부 카메라 시작 함수
  const startCamera = useCallback(
    (deviceId: string) => {
      return startCameraInternal(deviceId);
    },
    [startCameraInternal]
  );

  // 카메라 중지
  const stopCamera = useCallback(() => {
    setState(prev => {
      if (prev.stream) {
        prev.stream.getTracks().forEach(track => track.stop());
      }
      return { ...prev, stream: null };
    });
  }, []);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      setState(prev => {
        if (prev.stream) {
          prev.stream.getTracks().forEach(track => track.stop());
        }
        return prev;
      });
    };
  }, []);

  // 초기 로드
  useEffect(() => {
    getDevices();
  }, [getDevices]);

  return {
    ...state,
    startCamera,
    stopCamera,
    refreshDevices: getDevices,
  };
};

export default useCamera;
