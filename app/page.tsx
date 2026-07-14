"use client";
import { useUploadThing } from "@/src/utils/uploadthing";
import { useRouter } from "next/navigation";
import { useState, useRef, useCallback, useEffect } from "react";
import Image from 'next/image';
import { 
  createGoogleCalendarUrl, 
  downloadICSFile, 
  createOutlookCalendarUrl, 
  detectDevice 
} from '../src/utils/calendar-utils';

// ==========================================
// ETKİNLİK BİLGİLERİ
// ==========================================
const GROOM_NAME = "İsmail Sancak";
const BRIDE_NAME = "Sanem Aykut";



const DUGUN_EVENT = {
  title: "Sanem & İsmail - Düğün Töreni",
  date: new Date('2026-07-26T19:00:00'),
  endDate: new Date('2026-07-26T23:59:00'),
  locationName: "Hangar Event Hall",
  locationDetail: "",
  address: "Hangar Event Hall",
  mapsUrl: "https://www.google.com/maps/place/Hangar+Event+Hall/@39.8350425,32.8587382,17z/data=!3m1!4b1!4m6!3m5!1s0x14d345be55a8b28d:0xbcbc90bcb26b76ed!8m2!3d39.8350384!4d32.8613131!16s%2Fg%2F11y8klcx74?entry=ttu&g_ep=EgoyMDI2MDYxMC4wIKXMDSoASAFQAw%3D%3D",
  type: "dugun" as const,
  icon: "💒",
  label: "Düğün Töreni"
};

export default function Home() {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [convertedBlob, setConvertedBlob] = useState<Blob | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileUrls, setFileUrls] = useState<Map<File, string>>(new Map());
  const [showCalendarOptions, setShowCalendarOptions] = useState(false);
  const [calendarEventType, setCalendarEventType] = useState<'dugun'>('dugun');
  
  // Düğün etkinliği için geri sayım
  const [dugunTimeLeft, setDugunTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  
  // Notification sistemi için state'ler
  const [notifications, setNotifications] = useState<{
    id: number;
    message: string;
    type: 'success' | 'error';
    show: boolean;
  }[]>([]);
  
  // Notification ID counter
  const notificationIdRef = useRef(0);
  const [participants, setParticipants] = useState<string[]>([]);
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [activeTab, setActiveTab] = useState('text');
  // wedding music
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showMusicButton, setShowMusicButton] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null)
  
  // Ses kaydı için isim state'i eklendi
  const [userName, setUserName] = useState("");
  const [userStoppedMusic, setUserStoppedMusic] = useState(false);

  // Dosya seçimi için state'ler
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Not yazma için state'ler
  const [noteText, setNoteText] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("");
  const [isUploadingNote, setIsUploadingNote] = useState(false);

  // Müzik kontrolü
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
  
    const handleCanPlay = () => {
      console.log("🎵 Müzik dosyası hazır");
      audio.volume = 0.3;
      
      if (userInteracted && !userStoppedMusic) {
        audio.play()
          .then(() => {
            console.log("🎵 Müzik başlatıldı");
            setMusicPlaying(true);
            setShowMusicButton(false);
          })
          .catch(() => {
            setShowMusicButton(true);
          });
      } else {
        setShowMusicButton(true);
      }
    };
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', () => setMusicPlaying(true));
    audio.addEventListener('pause', () => setMusicPlaying(false));
  
    return () => {
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [userInteracted, userStoppedMusic]);
  
  // Notification gösterme fonksiyonu
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const id = ++notificationIdRef.current;
    const newNotification = { id, message, type, show: true };
    
    setNotifications(prev => [...prev, newNotification]);
    
    setTimeout(() => {
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === id ? { ...notif, show: false } : notif
        )
      );
      
      setTimeout(() => {
        setNotifications(prev => prev.filter(notif => notif.id !== id));
      }, 500);
    }, 5000);
  };
  
  // Açıklama metni oluşturma fonksiyonu
  const createDescription = (event: typeof NIKAH_EVENT | typeof DUGUN_EVENT, reminderText = "") => {
    const formattedDate = event.date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    
    const formattedTime = event.date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  
    return `Sevgili ${userName || 'Dostumuz'},
  
${BRIDE_NAME} & ${GROOM_NAME}'ın ${event.label.toLowerCase()}ne davetlisiniz!
  
📅 Tarih: ${formattedDate}
🕐 Saat: ${formattedTime}
📍 Mekan: ${event.address}
  
Bu özel günümüzde yanımızda olmanızdan mutluluk duyacağız.
  
${reminderText}
  
Sevgiler,
${BRIDE_NAME} & ${GROOM_NAME}`;
  };

  
  // Takvim ekleme fonksiyonları
  const addToGoogleCalendar = (event: typeof NIKAH_EVENT | typeof DUGUN_EVENT) => {
    const description = createDescription(event, "Hatırlatma: Etkinlikten önce bildirim alacaksınız.");
    const url = createGoogleCalendarUrl(event.title, event.date, event.endDate, event.address, description);
    window.open(url, '_blank');
    showNotification("Google Takvim açıldı! Etkinliği kaydetmeyi unutmayın.", "success");
  };
  
  const addToAppleCalendar = (event: typeof NIKAH_EVENT | typeof DUGUN_EVENT) => {
    const description = createDescription(event, "Hatırlatma: Etkinlikten 1 gün önce saat 10:00'da ve 2 saat önce bildirim alacaksınız.");
    downloadICSFile(event.title, event.date, event.endDate, event.address, description);
    showNotification("Takvim dosyası indirildi! Dosyayı açarak takviminize ekleyebilirsiniz.", "success");
  };
  
  const addToOutlookCalendar = (event: typeof NIKAH_EVENT | typeof DUGUN_EVENT) => {
    const description = createDescription(event, "Hatırlatma: Etkinlikten 1 gün önce ve 2 saat önce bildirim alacaksınız.");
    const url = createOutlookCalendarUrl(event.title, event.date, event.endDate, event.address, description);
    window.open(url, '_blank');
    showNotification("Outlook Takvim açıldı! Etkinliği kaydetmeyi unutmayın.", "success");
  };
  
  const handleAddToCalendar = (eventType: 'nikah' | 'dugun') => {
    const event = eventType === 'nikah' ? NIKAH_EVENT : DUGUN_EVENT;
    const device = detectDevice();
    
    if (device === 'ios') {
      addToAppleCalendar(event);
    } else if (device === 'android') {
      addToGoogleCalendar(event);
    } else {
      setCalendarEventType(eventType);
      setShowCalendarOptions(true);
    }
  };

  // Notification kapatma fonksiyonu
  const dismissNotification = (id: number) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, show: false } : notif
      )
    );
    
    setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif.id !== id));
    }, 500);
  };

  // Kullanıcı etkileşimi takibi
  useEffect(() => {
    const handleFirstInteraction = () => {
      setUserInteracted(true);
      
      const audio = audioRef.current;
      if (audio && !musicPlaying && !userStoppedMusic) {
        audio.play()
          .then(() => {
            console.log("🎵 İlk etkileşim sonrası müzik başlatıldı");
            setMusicPlaying(true);
            setShowMusicButton(false);
          })
          .catch(() => {
            setShowMusicButton(true);
          });
      }
    };
  
    const events = ['click', 'touchstart', 'keydown'];
    events.forEach(event => {
      document.addEventListener(event, handleFirstInteraction, { once: true });
    });
  
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleFirstInteraction);
      });
    };
  }, [musicPlaying, userStoppedMusic]);

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);
  
  useEffect(() => {
    const loadExistingParticipants = async () => {
      try {
        const response = await fetch('/api/get-participants');
        if (response.ok) {
          const data = await response.json();
          setParticipants(data.participants || []);
        }
      } catch (error) {
        console.log('Mevcut katılımcılar yüklenemedi:', error);
      }
    };
  loadExistingParticipants();
  }, []);

  // Otomatik müzik başlatma
  useEffect(() => {
    const startMusicAuto = () => {
      if (audioRef.current) {
        audioRef.current.volume = 0.3;
        audioRef.current.play().catch(console.error);
      }
    };
  
    startMusicAuto();
    
    const handleInteraction = () => {
      startMusicAuto();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);

  // Geliştirilmiş addParticipant fonksiyonu
  const addParticipant = async (name: string) => {
    if (!isValidName(name)) {
      return false;
    }
    
    try {
      setIsAddingParticipant(true);
      
      let existingParticipants: string[] = [];
      let existingFileKey: string | null = null;
      
      try {
        console.log('📋 Mevcut katılımcı listesi getiriliyor...');
        const cacheBuster = new Date().getTime();
        const response = await fetch(`/api/get-participants?t=${cacheBuster}`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          existingParticipants = data.participants || [];
          existingFileKey = data.fileKey;
          console.log('📋 Mevcut katılımcılar:', existingParticipants.length, 'FileKey:', existingFileKey);
        }
      } catch (error) {
        console.log("📋 Mevcut liste bulunamadı, yeni liste oluşturuluyor...");
      }
      
      const trimmedName = name.trim();
      if (existingParticipants.includes(trimmedName)) {
        showNotification("Bu isim zaten katılımcı listesinde mevcut!", "error");
        return false;
      }
      
      const updatedParticipants = [...existingParticipants, trimmedName];
      console.log('📋 Güncellenmiş katılımcı listesi:', updatedParticipants.length, 'katılımcı');
      
      const participantData = {
        participants: updatedParticipants,
        lastUpdated: new Date().toISOString(),
        totalCount: updatedParticipants.length
      };
      
      const jsonContent = JSON.stringify(participantData, null, 2);
      const jsonFile = new File([jsonContent], "katilimci-listesi.json", {
        type: "application/json",
      });
      
      setParticipants(updatedParticipants);
      
      console.log('📤 Yeni katılımcı dosyası yükleniyor...');
      
      try {
        await startParticipantUpload([jsonFile]);
        
        if (existingFileKey) {
          setTimeout(async () => {
            try {
              console.log('🗑️ Eski dosya siliniyor:', existingFileKey);
              
              const deleteResponse = await fetch('/api/delete-file', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ fileKey: existingFileKey }),
              });
              
              const deleteResult = await deleteResponse.json();
              if (deleteResponse.ok && deleteResult.success) {
                console.log('🗑️ Eski dosya başarıyla silindi');
              } else {
                console.warn('🗑️ Eski dosya silinemedi:', deleteResult);
              }
            } catch (error) {
              console.warn("🗑️ Eski dosya silme hatası:", error);
            }
          }, 3000);
        }
        
        console.log('✅ Katılımcı başarıyla eklendi:', trimmedName);
        return true;
        
      } catch (error) {
        console.error("❌ Katılımcı yükleme hatası:", error);
        showNotification("Katılımcı eklenirken hata oluştu!", "error");
        setParticipants(prev => prev.filter(p => p !== trimmedName));
        return false;
      }
      
    } catch (error) {
      console.error("❌ Katılımcı ekleme hatası:", error);
	  showNotification("Katılımcı eklenirken hata oluştu!", "error");
      setParticipants(prev => prev.filter(p => p !== name.trim()));
      return false;
    } finally {
      setIsAddingParticipant(false);
    }
  };
  
  // Müzik fonksiyonları
  const startMusic = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.play()
        .then(() => {
          setMusicPlaying(true);
          setShowMusicButton(false);
          setUserInteracted(true);
          setUserStoppedMusic(false);
        })
        .catch(console.error);
    }
  };
  
  const stopMusic = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      setMusicPlaying(false);
      setUserStoppedMusic(true);
    }
  };

  const uploadNote = async () => {
    if (!noteText.trim()) {
      showNotification("Lütfen bir mesaj yazın!", "error");
      return;
    }
    
    if (!isValidName(userName)) {
      showNotification("Lütfen adınızı ve soyadınızı tam olarak girin! (Örn: Ahmet Yılmaz)", "error");
      return;
    }
	
    try {
      const sanitizedName = userName.trim().replace(/[^a-zA-Z0-9çğıöşüÇĞIİÖŞÜ\s]/g, '').replace(/\s+/g, '_');
      const timestamp = new Date().toLocaleString('tr-TR').replace(/[/:]/g, '-').replace(/\s/g, '_');
      const fileName = `${sanitizedName}_f_Not${timestamp}.txt`;

      const noteContent = `Gönderen: ${userName}\nTarih: ${new Date().toLocaleString('tr-TR')}\n\nMesaj:\n${noteText}`;
      
      const noteFile = new File([noteContent], fileName, {
        type: "text/plain",
      });
  
      await startNoteUpload([noteFile]);
    } catch (error: any) {
      console.error("❌ Not yükleme hatası:", error);
      showNotification(`Not yükleme sırasında hata oluştu: ${error.message || "Bilinmeyen hata"}`, "error");
      setIsUploadingNote(false);
    }
  };
  
  // Geri Sayım Fonksiyonu
  const calculateTimeLeft = useCallback((targetDate: Date) => {
    const now = new Date().getTime();
    const target = targetDate.getTime();
    const difference = target - now;
    
    if (difference > 0) {
      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000)
      };
    }
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }, []);
  
  // Geri sayım timer
  useEffect(() => {
    setDugunTimeLeft(calculateTimeLeft(DUGUN_EVENT.date));
    
    const timer = setInterval(() => {
      setDugunTimeLeft(calculateTimeLeft(DUGUN_EVENT.date));
    }, 1000);
  
    return () => clearInterval(timer);
  }, [calculateTimeLeft]);
  
  // 3. Katılımcı yükleme için yeni hook
  const { startUpload: startParticipantUpload, isUploading: participantUploadThingUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res: any[]) => {
      console.log("✅ Katılımcı listesi güncellendi:", res);
      console.log("✅ Yeni dosya key:", res[0]?.key);
    },
    onUploadError: (error: Error) => {
      console.error("❌ Katılımcı listesi yükleme hatası:", error);
      showNotification(`Katılımcı listesi yükleme hatası: ${error.message}`, "error");
      setParticipants(prev => {
        const newList = [...prev];
        newList.pop();
        return newList;
      });
    },
    onUploadBegin: (name: string) => {
      console.log("📤 Katılımcı listesi yükleme başladı:", name);
    },
  });

  // Dosya yükleme için hook
  const { startUpload, isUploading: uploadThingUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res: any[]) => {
      console.log("✅ Dosya yükleme tamamlandı:", res);
      
      fileUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      setFileUrls(new Map());
      
      setSelectedFiles([]);
      setIsUploadingFile(false);
      setUploadProgress(0);
      showNotification("Dosyalar başarıyla gönderildi!", "success"); 
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    onUploadError: (error: Error) => {
      console.error("❌ Dosya yükleme hatası:", error);
      showNotification(`Yükleme hatası: ${error.message}`, "error");
      setIsUploadingFile(false);
      setUploadProgress(0);
    },
    onUploadBegin: (name: string) => {
      console.log("📤 Dosya yükleme başladı:", name);
      setIsUploadingFile(true);
    },
    onUploadProgress: (progress: number) => {
      setUploadProgress(progress);
    },
  });

  // Not yükleme için ayrı hook
  const { startUpload: startNoteUpload, isUploading: noteUploadThingUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res: any[]) => {
      console.log("✅ Not yükleme tamamlandı:", res);
      setNoteText("");
      setIsUploadingNote(false);
      showNotification("Mesajınız başarıyla gönderildi!", "success");
    },
    onUploadError: (error: Error) => {
      console.error("❌ Not yükleme hatası:", error);
      showNotification(`Yükleme hatası: ${error.message}`, "error");
      setIsUploadingNote(false);
    },
    onUploadBegin: (name: string) => {
      console.log("📤 Not yükleme başladı:", name);
      setIsUploadingNote(true);
    },
  });

  // Ses yükleme için ayrı hook
  const { startUpload: startAudioUpload, isUploading: audioUploadThingUploading } = useUploadThing("imageUploader", {
    onClientUploadComplete: (res: any[]) => {
      console.log("✅ Ses yükleme tamamlandı:", res);
      setAudioBlob(null);
      setConvertedBlob(null);
      setRecordingTime(0);
      setIsUploading(false);
      showNotification("Ses kaydı başarıyla gönderildi!", "success");
    },
    onUploadError: (error: Error) => {
      console.error("❌ Ses yükleme hatası:", error);
      showNotification(`Yükleme hatası: ${error.message}`, "error");
      setIsUploading(false);
    },
    onUploadBegin: (name: string) => {
      console.log("📤 Ses yükleme başladı:", name);
      setIsUploading(true);
    },
  });

  // Dosya seçimi fonksiyonları
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      setSelectedFiles(prev => [...prev, ...fileArray]);
      
      fileArray.forEach(file => {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          setFileUrls(prev => new Map(prev).set(file, url));
        }
      });
    }
    
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleAddParticipant = async () => {
    if (!isValidName(userName)) {
      showNotification("Lütfen geçerli bir isim girin!", "error");
      return;
    }
    
    const success = await addParticipant(userName.toLowerCase());
    if (success) {
      showNotification("Katılımcı listesine eklendi!", "success");
    }
  };
  
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    
    const files = event.dataTransfer.files;
    if (files) {
      const fileArray = Array.from(files);
      setSelectedFiles(prev => [...prev, ...fileArray]);
      
      fileArray.forEach(file => {
        if (file.type.startsWith('image/')) {
          const url = URL.createObjectURL(file);
          setFileUrls(prev => new Map(prev).set(file, url));
        }
      });
    }
  };

  const removeFile = (index: number) => {
    const fileToRemove = selectedFiles[index];
    
    const url = fileUrls.get(fileToRemove);
    if (url) {
      URL.revokeObjectURL(url);
      setFileUrls(prev => {
        const newMap = new Map(prev);
        newMap.delete(fileToRemove);
        return newMap;
      });
    }
    
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      setIsUploadingFile(true);
      
      const renamedFiles = selectedFiles.map(file => {
        const sanitizedName = userName.trim().replace(/[^a-zA-Z0-9çğıöşüÇĞIİÖŞÜ\s]/g, '').replace(/\s+/g, '_');
        const fileExtension = file.name.split('.').pop();
        const originalFileName = file.name.replace(`.${fileExtension}`, '');
        const newFileName = `${sanitizedName}_f_${originalFileName}.${fileExtension}`;
        
        return new File([file], newFileName, {
          type: file.type,
          lastModified: file.lastModified,
        });
      });
      
      await startUpload(renamedFiles);
    } catch (error: any) {
      console.error("❌ Dosya yükleme hatası:", error);
      showNotification(`Dosya yükleme sırasında hata oluştu: ${error.message || "Bilinmeyen hata"}`, "error");
      setIsUploadingFile(false);
      setUploadProgress(0);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isValidName = (name: string) => {
    const trimmedName = name.trim();
    return trimmedName.length >= 3 && trimmedName.includes(' ');
  };

  const handleStartRecording = () => {
    stopMusic();
    startRecording();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        options.mimeType = 'audio/wav';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/wav';
        const blob = new Blob(chunks, { type: mimeType });
        setAudioBlob(blob);
        
        await convertToWav(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
	  
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Mikrofon erişimi hatası:", error);
      showNotification("Mikrofon erişimi sağlanamadı. Lütfen tarayıcı ayarlarınızı kontrol edin.", "error");
    }
  };

  const stopRecording = () => {
    try {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
  
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
  
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      }
    } catch (error) {
      console.error("Recording stop error:", error);
      setIsRecording(false);
    }
  };

  const convertToWav = async (inputBlob: Blob) => {
    setIsConverting(true);
    let audioContext: AudioContext | null = null;
    
    try {
      audioContext = new AudioContext();
      const arrayBuffer = await inputBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
      const channelData = audioBuffer.getChannelData(0);
      const samples = new Int16Array(channelData.length);
  
      for (let i = 0; i < channelData.length; i++) {
        samples[i] = Math.max(-32768, Math.min(32767, channelData[i] * 32768));
      }
  
      const wavBlob = createWavBlob(samples, audioBuffer.sampleRate);
      setConvertedBlob(wavBlob);
    } catch (error) {
      console.error("Dönüştürme hatası:", error);
      setConvertedBlob(inputBlob);
    } finally {
      if (audioContext && audioContext.state !== 'closed') {
        await audioContext.close();
      }
      setIsConverting(false);
    }
  };

  const createWavBlob = (samples: Int16Array, sampleRate: number): Blob => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      view.setInt16(offset, samples[i], true);
      offset += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
  };

  const uploadAudio = async () => {
    const blobToUpload = convertedBlob || audioBlob;
    if (!blobToUpload) {
      console.error("Yüklenecek ses dosyası bulunamadı");
      return;
    }

    if (!isValidName(userName)) {
      showNotification("Lütfen adınızı ve soyadınızı tam olarak girin! (Örn: Ahmet Yılmaz)", "error");
      return;
    }
	
    try {
      const sanitizedName = userName.trim().replace(/[^a-zA-Z0-9çğıöşüÇĞIİÖŞÜ\s]/g, '').replace(/\s+/g, '_');
      const timestamp = new Date().toLocaleString('tr-TR').replace(/[/:]/g, '-').replace(/\s/g, '_');
      const fileName = `${sanitizedName}_f_Ses_Kaydı${timestamp}.wav`;
      
      const audioFile = new File([blobToUpload], fileName, {
        type: "audio/wav",
      });

      await startAudioUpload([audioFile]);
    } catch (error: any) {
      console.error("❌ Ses yükleme hatası:", error);
      showNotification(`Ses yükleme sırasında hata oluştu: ${error.message || "Bilinmeyen hata"}`, "error");
      setIsUploading(false);
    }
  };

  const openInMaps = (address: string, mapsUrl?: string) => {
    const url = mapsUrl || `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setConvertedBlob(null);
    setRecordingTime(0);
  };

  const audioUrl = useMemo(() => {
    if (convertedBlob) return URL.createObjectURL(convertedBlob);
    if (audioBlob) return URL.createObjectURL(audioBlob);
    return null;
  }, [convertedBlob, audioBlob]);

  useEffect(() => {
    return () => {
      fileUrls.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, [fileUrls]);
  
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Geri sayım bileşeni
  const CountdownDisplay = ({ timeLeft, label }: { timeLeft: { days: number; hours: number; minutes: number; seconds: number }; label: string }) => (
    <div className="grid grid-cols-4 gap-3">
      {[
        { value: timeLeft.days, unit: 'Gün' },
        { value: timeLeft.hours, unit: 'Saat' },
        { value: timeLeft.minutes, unit: 'Dakika' },
        { value: timeLeft.seconds, unit: 'Saniye' },
      ].map((item, i) => (
        <div key={i} className="countdown-box">
          <div className="number">{item.value}</div>
          <div className="label">{item.unit}</div>
        </div>
      ))}
    </div>
  );

  const EventCard = ({ event, timeLeft, isPassed }: { event: typeof NIKAH_EVENT | typeof DUGUN_EVENT; timeLeft: { days: number; hours: number; minutes: number; seconds: number }; isPassed: boolean }) => (
    <div className="event-card mb-4" style={{ animationDelay: event.type === 'dugun' ? '0.2s' : '0s' }}>
      <div className="text-center mb-4">
        <span className="text-3xl mb-2 block">{event.icon}</span>
        <h3 className="font-elegant text-xl text-gold-gradient font-semibold">{event.label}</h3>
      </div>
      
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">📅</span>
          <span className="text-white/70">
            {event.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">🕐</span>
          <span className="text-white/70">
            {event.date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-lg">📍</span>
          <span className="text-white/70">
            {event.locationName}
            {event.locationDetail && <span className="text-gold-gradient font-medium"> - {event.locationDetail}</span>}
          </span>
        </div>
      </div>

      {!isPassed ? (
        <CountdownDisplay timeLeft={timeLeft} label={event.label} />
      ) : (
        <div className="text-center py-3 px-4 rounded-xl bg-green-500/10 border border-green-500/20">
          <span className="text-green-400 text-sm font-medium">✨ Bu etkinlik tamamlandı</span>
        </div>
      )}
      
      <div className="flex gap-2 mt-4">
        <button
          onClick={() => openInMaps(event.address, event.mapsUrl)}
          className="flex-1 btn-gold text-xs sm:text-sm py-2.5 px-3 flex items-center justify-center gap-1.5"
        >
          <span>🗺️</span>
          <span>Haritada Göster</span>
        </button>
        <button
          onClick={() => handleAddToCalendar(event.type)}
          className="flex-1 btn-rose text-xs sm:text-sm py-2.5 px-3 flex items-center justify-center gap-1.5"
        >
          <span>📅</span>
          <span>Takvime Ekle</span>
        </button>
      </div>
    </div>
  );

  return (
      <main className="flex min-h-screen flex-col items-center px-4 py-6 sm:px-6 md:px-8 lg:px-24 relative safe-area-bottom">
        {/* Sparkle decorations */}
        <div className="sparkle-container">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="sparkle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${2 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        {/* Otomatik Müzik */}
        <audio
          ref={audioRef}
          src="/wedding-music.mp3"
          loop
          preload="auto"
          className="hidden"
        />

        {/* Müzik başlat butonu */}
        {showMusicButton && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
            <button
              onClick={startMusic}
              className="btn-gold px-5 py-2.5 text-sm rounded-full flex items-center gap-2 animate-bounce"
            >
              🎵 Müziği Başlat
            </button>
          </div>
        )}
        
        {/* Müzik Kontrol Paneli */}
        {(musicPlaying || userStoppedMusic) && userInteracted && (
          <div className="fixed bottom-4 left-4 z-50 music-control flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={musicPlaying ? "text-green-400 animate-pulse" : "text-white/40"}>🎵</span>
              <span className="text-xs font-medium text-white/70">
                {musicPlaying ? "Çalıyor" : "Durdu"}
              </span>
            </div>
            {musicPlaying ? (
              <button
                onClick={stopMusic}
                className="text-white/50 hover:text-red-400 transition-colors text-lg"
                title="Müziği durdur"
              >
                ⏸️
              </button>
            ) : (
              <button
                onClick={startMusic}
                className="text-white/50 hover:text-green-400 transition-colors text-lg"
                title="Müziği başlat"
              >
                ▶️
              </button>
            )}
          </div>
        )}
        
        {/* Notification Container */}
        <div className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
          <div className="flex flex-col items-center pt-4 px-4 space-y-2">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className={`
                  max-w-md w-full pointer-events-auto transform transition-all duration-500 ease-in-out
                  ${notification.show 
                    ? 'translate-y-0 opacity-100 scale-100' 
                    : '-translate-y-full opacity-0 scale-95'
                  }
                  ${notification.type === 'success' 
                    ? 'notification-success' 
                    : 'notification-error'
                  }
                  rounded-2xl shadow-2xl p-4 flex items-center justify-between backdrop-blur-sm
                `}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {notification.type === 'success' ? (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </div>
                  <p className="text-sm font-medium text-white">
                    {notification.message}
                  </p>
                </div>
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="flex-shrink-0 ml-4 text-white/60 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
  
        {/* ============================================ */}
        {/* HERO BÖLÜMÜ - Fotoğraf ve İsimler */}
        {/* ============================================ */}
        <div className="text-center max-w-lg w-full animate-fade-in-up relative z-10 mb-8 pt-4">


          {/* Fotoğraf */}
          <div className="photo-frame mx-auto mb-6 w-40 h-40 sm:w-48 sm:h-48">
            <Image
              src="/couple-photo.jpg"
              alt="Sanem & İsmail"
              width={192}
              height={192}
              className="object-cover"
              priority
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* İsimler */}
          <h1 className="font-elegant text-3xl sm:text-4xl md:text-5xl text-gold-gradient font-semibold mb-2 tracking-wide">
            Sanem & İsmail
          </h1>
          <p className="text-white/40 text-sm tracking-[0.2em] uppercase mb-1">Aykut & Sancak</p>
          
          {/* Dekoratif alt çizgi */}
          <div className="divider-ornament mt-4">
            <span className="text-white/30 text-lg">💍</span>
          </div>
        </div>

        {/* ============================================ */}
        {/* ETKİNLİK KARTI - Düğün */}
        {/* ============================================ */}
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg mb-6 relative z-10 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <h2 className="font-elegant text-xl sm:text-2xl text-center text-white/90 mb-4 flex items-center justify-center gap-2">
            <span className="text-gold-gradient">✨</span>
            <span>Etkinlik</span>
            <span className="text-gold-gradient">✨</span>
          </h2>
          
          {/* Düğün Kartı */}
          <EventCard event={DUGUN_EVENT} timeLeft={dugunTimeLeft} isPassed={false} />
        </div>

        {/* ============================================ */}
        {/* İSİM GİRİŞİ BÖLÜMÜ */}
        {/* ============================================ */}
        <div className="mb-6 w-full max-w-sm sm:max-w-md md:max-w-lg relative z-10 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <h2 className="font-elegant text-xl sm:text-2xl text-center text-white/90 mb-4">
            👤 İsim Bilgisi
          </h2>
          
          <div className="glass-card p-5 sm:p-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-white/60 text-center">
                Fotoğraf, video ve mesaj gönderebilmek için lütfen adınızı ve soyadınızı girin ✍️
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Adınız ve Soyadınız"
                className="input-dark"
                maxLength={50}
                autoComplete="off"
                spellCheck="false"
              />
              {userName.trim() && !isValidName(userName) && (
                <p className="text-xs text-amber-400/80">
                  ⚠️ Lütfen adınızı ve soyadınızı tam olarak girin (Örn: Ahmet Yılmaz)
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ============================================ */}
        {/* MESAJ BÖLÜMÜ */}
        {/* ============================================ */}
        <div className="mb-6 w-full max-w-sm sm:max-w-md md:max-w-lg relative z-10 animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
          <p className="text-center text-white/50 text-sm sm:text-base mb-6 px-2">
            Bu özel günümüzde çektiğiniz güzel anıları ve içten dileklerinizi bizimle paylaşabilirsiniz
          </p>
        </div>

        {/* ============================================ */}
        {/* FOTOĞRAF/VİDEO YÜKLEME */}
        {/* ============================================ */}
        <div className="mb-6 w-full max-w-sm sm:max-w-md md:max-w-lg relative z-10 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <h2 className="font-elegant text-xl sm:text-2xl text-center text-white/90 mb-4">
            📸 Fotoğraf ve Video
          </h2>
          
          <div
            className={`dropzone ${isDragging ? 'dropzone-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="text-4xl sm:text-5xl mb-3 animate-float">📤</div>
            <p className="text-base font-semibold text-white/70 mb-1">
              {isDragging ? "Dosyaları buraya bırakın" : "Dosya seçin veya sürükleyip bırakın"}
            </p>
            <p className="text-xs text-white/40 mb-3">
              Resim ve videolar (Maks. 1GB)
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,.heic,.heif,.mov,.mp4,.jpeg,.jpg,.png,.gif,.webp,.avif"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <button
              type="button"
              className="btn-gold text-sm py-2 px-5 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                  fileInputRef.current.click();
                }
              }}
            >
              📁 Dosya Seç
            </button>
          </div>
  
          {/* Seçilen Dosyalar */}
          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-3">
              <h3 className="font-semibold text-white/80 text-sm">Seçilen Dosyalar:</h3>
              <div className="max-h-40 sm:max-h-80 overflow-y-auto grid grid-cols-3 gap-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="glass-card-light p-2 space-y-2">
                   {file.type.startsWith('image/') && (
                     <div className="relative w-full h-20 rounded-lg overflow-hidden">
                       <Image 
                         src={fileUrls.get(file) || ''}
                         alt={file.name}
                         fill
                         className="object-cover"
                         sizes="(max-width: 768px) 33vw, 25vw"
                       />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-xs font-medium text-white/70 truncate">{file.name}</p>
                        <p className="text-xs text-white/40">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="text-red-400 hover:text-red-300 font-bold text-sm p-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <button
                onClick={uploadFiles}
                disabled={
                  isUploadingFile || 
                  uploadThingUploading || 
                  selectedFiles.length === 0 || 
                  !isValidName(userName)
                }
                className={`w-full py-3 px-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 text-sm ${
                  isUploadingFile || 
                  uploadThingUploading || 
                  selectedFiles.length === 0 || 
                  !isValidName(userName)
                    ? "bg-white/5 text-white/30 cursor-not-allowed"
                    : "btn-gold"
                }`}
              >
                {isUploadingFile || uploadThingUploading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>Yükleniyor...</span>
                    {uploadProgress > 0 && <span>%{uploadProgress}</span>}
                  </>
                ) : (
                  <>
                    <span>⬆️</span>
                    <span>
                      {!isValidName(userName) 
                        ? "İsiminizi Giriniz" 
                        : `${selectedFiles.length} Dosyayı Yükle`
                      }
                    </span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* MESAJ YAZMA VE SES KAYDI */}
        {/* ============================================ */}
        <div className="mb-6 w-full max-w-sm sm:max-w-md md:max-w-lg relative z-10 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <h2 className="font-elegant text-xl sm:text-2xl text-center text-white/90 mb-4">
            💌 Mesaj Gönder
          </h2>      
          
          <div className="glass-card p-4 sm:p-5 md:p-6">
            
            {/* Tab Butonları */}
            <div className="flex gap-2 p-1 rounded-xl mb-6 bg-white/5">
              <button
                onClick={() => setActiveTab('text')}
                className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm transition-all duration-300 ${
                  activeTab === 'text' ? 'tab-active' : 'tab-inactive'
                }`}
              >
                📝 Metin Mesajı
              </button>
              <button
                onClick={() => setActiveTab('voice')}
                className={`flex-1 py-2.5 px-3 rounded-lg font-medium text-sm transition-all duration-300 ${
                  activeTab === 'voice' ? 'tab-active' : 'tab-inactive'
                }`}
              >
                🎤 Ses Kaydı
              </button>
            </div>

            {/* Metin Mesajı */}
            {activeTab === 'text' && (
              <div className="min-h-[350px] flex flex-col">
                <div className="text-center mb-5">
                  <h3 className="text-lg font-semibold text-white/90 mb-1">Metin Mesajı</h3>
                  <p className="text-white/40 text-xs">
                    Düşüncelerinizi metin olarak paylaşın. Maksimum 1000 karakter.
                  </p>
                </div>

                <div className="flex-1 flex flex-col justify-center">
                  <div className="space-y-3">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Düğün için güzel dileklerinizi, anılarınızı veya mesajınızı buraya yazabilirsiniz..."
                      className="textarea-dark"
                      rows={6}
                      maxLength={1000}
                    />
                    <div className="flex justify-between items-center text-xs text-white/40">
                      <span>Maksimum 1000 karakter</span>
                      <span className={noteText.length > 900 ? 'text-amber-400 font-medium' : ''}>
                        {noteText.length}/1000
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    onClick={uploadNote}
                    disabled={isUploadingNote || noteUploadThingUploading || !noteText.trim() || !isValidName(userName)}
                    className={`w-full py-3.5 px-6 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-3 text-sm ${
                      isUploadingNote || noteUploadThingUploading || !noteText.trim() || !isValidName(userName)
                        ? "bg-white/5 text-white/30 cursor-not-allowed"
                        : "btn-gold"
                    }`}
                  >
                    {(isUploadingNote || noteUploadThingUploading) ? (
                      <>
                        <span className="animate-spin text-lg">⏳</span>
                        <span>Gönderiliyor...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-lg">📤</span>
                        <span>
                          {!isValidName(userName) 
                            ? "İsiminizi Giriniz" 
                            : "Mesajı Gönder"
                          }
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Ses Kaydı */}
            {activeTab === 'voice' && (
              <div className="min-h-[350px] flex flex-col">
                
                {!audioBlob ? (
                  <>
                    <div className="text-center mb-5">
                      <h3 className="text-lg font-semibold text-white/90 mb-1">Sesli Mesaj</h3>
                      <p className="text-white/40 text-xs">
                        Düşüncelerinizi sesli olarak paylaşın. Maksimum 5 dakika.
                      </p>
                    </div>

                    <div className="flex-1 flex flex-col justify-center items-center">
                      {!isRecording ? (
                        <div className="text-center">
                          <div className="glass-card-light p-8 mb-5">
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                              <span className="text-2xl text-white/30">🎙️</span>
                            </div>
                            <p className="text-white/40 text-sm">
                              Kayda başlamak için butona basın
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full max-w-xs">
                          <div className="rounded-xl p-6 text-center border border-red-500/20 bg-red-500/5">
                            <div className="flex items-center justify-center gap-3 mb-3">
                              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                              <span className="text-2xl font-mono text-red-400 font-bold">
                                {formatTime(recordingTime)}
                              </span>
                            </div>
                            <p className="text-red-400 font-medium text-sm">
                              Kayıt devam ediyor...
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-5">
                      {!isRecording ? (
                        <button
                          onClick={handleStartRecording}
                          className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:scale-95"
                        >
                          <span className="text-lg">🎙️</span>
                          <span>Kayda Başla</span>
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="w-full bg-white/10 hover:bg-white/15 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-300 shadow-lg transform active:scale-95 border border-white/10"
                        >
                          <span className="text-lg">⏹️</span>
                          <span> Kaydı Durdur</span>
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center mb-5">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-400/20 to-green-600/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500/20">
                        <span className="text-2xl text-green-400">✓</span>
                      </div>
                      <h3 className="text-lg font-semibold text-white/90 mb-1">
                        {isConverting ? "İşleniyor..." : "Kayıt Hazır!"}
                      </h3>
                      <p className="text-white/40 text-xs">
                        Süre: {formatTime(recordingTime)}
                        {userName.trim() && (
                          <span className="block mt-1">Kayıt: {userName}</span>
                        )}
                      </p>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      <div className="glass-card-light p-5">
                        <audio 
                          controls 
                          className="w-full" 
                          src={audioUrl ?? undefined}
                          style={{height: '44px'}}
                        >
                          Tarayıcınız ses oynatmayı desteklemiyor.
                        </audio>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-5">
                      <button
                        onClick={uploadAudio}
                        disabled={isUploading || audioUploadThingUploading || isConverting || !isValidName(userName)}
                        className={`flex-1 font-semibold py-3.5 px-5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm ${
                          isUploading || audioUploadThingUploading || isConverting || !isValidName(userName) 
                            ? "bg-white/5 text-white/30 cursor-not-allowed" 
                            : "btn-gold"
                        }`}
                      >
                        {(isUploading || audioUploadThingUploading) ? (
                          <>
                            <span className="animate-spin text-lg">⏳</span>
                            <span>Yükleniyor</span>
                          </>
                        ) : isConverting ? (
                          <>
                            <span className="animate-spin text-lg">🔄</span>
                            <span>İşleniyor</span>
                          </>
                        ) : (
                          <>
                            <span className="text-lg">📤</span>
                            <span>
                              {!isValidName(userName) ? "İsminizi Giriniz" : "Kaydı Yükle"}
                            </span>
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={deleteRecording}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 font-semibold py-3.5 px-4 rounded-xl transition-all duration-300 border border-red-500/20 hover:border-red-500/30 active:scale-95"
                      >
                        <span className="text-lg">🗑️</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ============================================ */}
        {/* TAKVİM SEÇENEKLERİ MODAL */}
        {/* ============================================ */}
        {showCalendarOptions && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="glass-card max-w-sm w-full p-6 space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-elegant font-semibold text-white/90 mb-2">
                  📅 Takvime Ekle
                </h3>
                <p className="text-sm text-white/50 mb-4">
                  {calendarEventType === 'nikah' ? NIKAH_EVENT.label : DUGUN_EVENT.label} için
                  <br />hangi takvim uygulamasını kullanmak istiyorsunuz?
                </p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => {
                    const event = calendarEventType === 'nikah' ? NIKAH_EVENT : DUGUN_EVENT;
                    addToGoogleCalendar(event);
                    setShowCalendarOptions(false);
                  }}
                  className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 border border-red-500/20"
                >
                  <span>📅</span>
                  <span>Google Takvim</span>
                </button>
                
                <button
                  onClick={() => {
                    const event = calendarEventType === 'nikah' ? NIKAH_EVENT : DUGUN_EVENT;
                    addToOutlookCalendar(event);
                    setShowCalendarOptions(false);
                  }}
                  className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 border border-blue-500/20"
                >
                  <span>📅</span>
                  <span>Outlook Takvim</span>
                </button>
                
                <button
                  onClick={() => {
                    const event = calendarEventType === 'nikah' ? NIKAH_EVENT : DUGUN_EVENT;
                    addToAppleCalendar(event);
                    setShowCalendarOptions(false);
                  }}
                  className="w-full bg-white/10 hover:bg-white/15 text-white/70 font-medium py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 border border-white/10"
                >
                  <span>📅</span>
                  <span>Apple Takvim (.ics)</span>
                </button>
              </div>
              
              <button
                onClick={() => setShowCalendarOptions(false)}
                className="w-full bg-white/5 hover:bg-white/10 text-white/50 font-medium py-2.5 px-4 rounded-xl transition-all duration-300"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 mb-4 text-center relative z-10">
          <div className="divider-ornament mb-4">
            <span className="text-white/20 text-xs">♥</span>
          </div>
          <p className="text-white/20 text-xs font-elegant">
            Sanem & İsmail
          </p>
        </div>
      </main>
    );
}
