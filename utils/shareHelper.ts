import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

/**
 * Shared helper: captures a DOM element as an image and shares/downloads it.
 * Eliminates duplication between shareInvoice and shareHistory.
 */
export const captureAndShare = async (
  elementRef: React.RefObject<HTMLDivElement>,
  fileName: string,
  title: string,
  text: string,
): Promise<void> => {
  if (!elementRef.current) {
    alert('خطأ في إنشاء الصورة');
    return;
  }

  const canvas = await html2canvas(elementRef.current, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  });

  const base64Data = canvas.toDataURL('image/png').split(',')[1];

  const downloadFallback = async () => {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/png', 1.0);
    });
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (Capacitor.isNativePlatform()) {
    try {
      // Native Android/iOS sharing
      const savedFile = await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
      });

      await Share.share({ title, text, url: savedFile.uri, dialogTitle: title });
    } catch (shareError: any) {
      console.error('Native share failed, falling back to download:', shareError);
      await downloadFallback();
    }
  } else {
    // Web / PC sharing
    try {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
      if (blob) {
        const file = new File([blob], fileName, { type: 'image/png' });
        // Check if browser explicitly supports sharing files
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title,
            text,
            files: [file]
          });
        } else {
          // If browser doesn't support file sharing, download it directly
          await downloadFallback();
        }
      }
    } catch (e) {
      console.error('Web share cancelled or failed:', e);
      // Some browsers throw AbortError if the user simply cancels the share dialog.
      // We don't unnecessarily force a download if they manually cancelled, 
      // but if the share totally fails we can attempt download.
      if (e instanceof Error && e.name !== 'AbortError') {
        await downloadFallback();
      }
    }
  }
};
