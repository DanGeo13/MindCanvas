import React, { useState, useRef, useEffect, useCallback } from 'react';
import { XMarkIcon, ArrowPathIcon } from './icons';

interface CameraViewProps {
  onClose: () => void;
  onCapture: (blob: Blob, mimeType: string) => void;
}

const CameraView: React.FC<CameraViewProps> = ({ onClose, onCapture }) => {
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const setupCamera = useCallback(async (currentFacingMode: 'environment' | 'user', currentMode: 'photo' | 'video') => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const constraints: MediaStreamConstraints = {
        video: { 
          facingMode: currentFacingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: currentMode === 'video',
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Could not access camera. Please check permissions.');
      onClose();
    }
  }, [stream, onClose]);

  useEffect(() => {
    setupCamera(facingMode, mode);

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, mode]);

  const handleFlipCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleTakePicture = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          if (blob) {
            setPreview(URL.createObjectURL(blob));
            setPreviewBlob(blob);
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const handleStartRecording = () => {
    if (stream) {
      recordedChunksRef.current = [];
      const options = { mimeType: 'video/webm; codecs=vp9' };
      try {
        mediaRecorderRef.current = new MediaRecorder(stream, options);
      } catch (e) {
        console.error('Error creating MediaRecorder with vp9, falling back:', e);
        mediaRecorderRef.current = new MediaRecorder(stream);
      }
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        setPreview(URL.createObjectURL(blob));
        setPreviewBlob(blob);
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleShutterClick = () => {
    if (mode === 'photo') {
      handleTakePicture();
    } else {
      if (isRecording) {
        handleStopRecording();
      } else {
        handleStartRecording();
      }
    }
  };

  const handleRetake = () => {
    setPreview(null);
    setPreviewBlob(null);
    URL.revokeObjectURL(preview as string);
  };

  const handleConfirm = () => {
    if (previewBlob) {
      onCapture(previewBlob, previewBlob.type);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
      <div className="relative flex-1 bg-gray-900">
        {preview ? (
          <div className="w-full h-full flex items-center justify-center">
             {previewBlob?.type.startsWith('image/') ? (
                <img src={preview} alt="Preview" className="max-w-full max-h-full object-contain" />
             ) : (
                <video src={preview} controls autoPlay className="max-w-full max-h-full" />
             )}
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        )}

        <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-black/50 rounded-full text-white z-10">
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      <div className="bg-black py-6 relative flex flex-col items-center justify-center">
        {preview ? (
            <div className="flex justify-around items-center w-full px-4">
                <button onClick={handleRetake} className="text-white font-semibold text-lg">Retake</button>
                <button onClick={handleConfirm} className="bg-blue-500 text-white font-semibold px-8 py-3 rounded-full text-lg">Use {mode === 'photo' ? 'Photo' : 'Video'}</button>
            </div>
        ) : (
          <>
            <div className="flex justify-center items-center w-full">
              <button onClick={handleShutterClick} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center" aria-label={mode === 'photo' ? 'Take Picture' : isRecording ? 'Stop Recording' : 'Start Recording'}>
                  {mode === 'video' && isRecording && <div className="w-8 h-8 bg-red-500 rounded-md animate-pulse"></div>}
              </button>
            </div>

            <div className="absolute bottom-6 w-full px-8 flex justify-between items-center text-sm">
                <button 
                    onClick={() => setMode('photo')} 
                    className={`font-semibold px-3 py-1 rounded-full ${mode === 'photo' ? 'text-white bg-gray-700/80' : 'text-gray-400'}`}
                >
                    PHOTO
                </button>
                 <button 
                    onClick={() => setMode('video')} 
                    className={`font-semibold px-3 py-1 rounded-full ${mode === 'video' ? 'text-white bg-gray-700/80' : 'text-gray-400'}`}
                >
                    VIDEO
                </button>
            </div>
          </>
        )}
         {!preview &&
            <div className="absolute top-1/2 -translate-y-1/2 right-4">
                <button onClick={handleFlipCamera} className="p-3 bg-gray-800/70 rounded-full text-white" aria-label="Flip Camera">
                    <ArrowPathIcon className="w-6 h-6" />
                </button>
            </div>
         }
      </div>
    </div>
  );
};

export default CameraView;
