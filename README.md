# 🎯 YOLO11 - 브라우저 기반 실시간 객체 감지

ONNX Runtime Web 기반 브라우저 실시간 YOLO11 객체 감지 시스템입니다.
WebGPU 가속과 WASM(CPU) 폴백을 지원하며, 웹캠을 통한 실시간 영상 처리가 가능합니다.

![YOLO11 웹 데모](/public/screen.png)

## ✨ 주요 기능

- **실시간 추론** - 웹캠을 통한 실시간 객체 감지
- **WebGPU 가속** - CPU 대비 최대 10배 빠른 처리 속도
- **다양한 모델** - 감지, 세그멘테이션, 포즈 추정 지원
- **설치 불필요** - 브라우저에서 바로 실행
- **카메라 선택** - 사용 가능한 카메라 자동 인식

## 🚀 지원 모델

**사용 가능한 YOLO11 모델**

| 모델         | 타입         | 입력 크기 | 용량   | 기능                         |
| ------------ | ------------ | --------- | ------ | ---------------------------- |
| YOLO11n      | 객체 감지    | 640×640   | 10.7MB | 80가지 객체 클래스 감지      |
| YOLO11n-seg  | 세그멘테이션 | 640×640   | 11.7MB | 인스턴스 세그멘테이션 마스크 |
| YOLO11n-pose | 포즈 추정    | 640×640   | 11.8MB | 17개 인체 관절 추정          |

**추론 백엔드**

- **WebGPU** - GPU 가속 추론 (Chrome 113+ 지원)
- **WASM** - 멀티스레딩 CPU 폴백
- **ONNX Runtime Web** - 브라우저 최적화 실행 환경

## 🛠️ 기술 스택

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS**
- **ONNX Runtime Web**
- **pnpm**

## ⚡ Setup

```bash
# clone
git clone https://github.com/your-username/react-yolo11n-object-detection-web.git
cd react-yolo11n-object-detection-web

# install dependencies
pnpm install

# start dev server
pnpm dev
```
