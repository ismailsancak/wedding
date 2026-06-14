import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";

const f = createUploadthing();
// Lazy initialize UTApi to prevent build-time crashes when UPLOADTHING_SECRET/TOKEN is missing.
let utapiInstance: UTApi | null = null;
const getUtapi = () => {
  if (!utapiInstance) {
    if (process.env.UPLOADTHING_TOKEN && !process.env.UPLOADTHING_SECRET) {
      try {
        const decoded = JSON.parse(Buffer.from(process.env.UPLOADTHING_TOKEN, 'base64').toString('utf-8'));
        if (decoded.apiKey) {
          process.env.UPLOADTHING_SECRET = decoded.apiKey;
        }
        if (decoded.appId) {
          process.env.UPLOADTHING_APP_ID = decoded.appId;
        }
      } catch (e) {
        console.error("UploadThing token parse hatası:", e);
      }
    }
    utapiInstance = new UTApi();
  }
  return utapiInstance;
};

// FileRouter for your app, kimlik doğrulama YOK
export const ourFileRouter = {
  imageUploader: f({
    image: { maxFileSize: "1GB", maxFileCount: 200 },
    video: { maxFileSize: "1GB", maxFileCount: 50 },
    audio: { maxFileSize: "64MB", maxFileCount: 100 },
    text: { maxFileSize: "1MB", maxFileCount: 100 }, // Text dosyaları için açık destek
    "application/json": { maxFileSize: "1MB", maxFileCount: 100 }, // JSON dosyaları için
    "application/octet-stream": { maxFileSize: "1MB", maxFileCount: 100 }, // Fallback
  })
    .middleware(async () => {
      return { userId: "anonymous" };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("✅ Upload complete by:", metadata.userId);
      console.log("📁 File URL:", file.url);
      console.log("🎵 File type:", file.type);
      console.log("📏 File size:", file.size);
      console.log("📝 File name:", file.name);
      
      // JSON dosyası kontrolü
      const isJsonFile = file.type === "application/json" || file.name.endsWith('.json');
      if (isJsonFile) {
        console.log("📋 JSON file detected!");
      }
      
      try {
        // Eğer katılımcı listesi dosyası yükleniyorsa, eski dosyaları sil
        if (file.name === 'katilimci-listesi.json') {
          console.log('📋 Katılımcı listesi güncelleniyor...');
          
          // Mevcut tüm dosyaları al
          const filesResponse = await getUtapi().listFiles();
          console.log('📂 ListFiles response:', filesResponse);
          console.log('📂 Response type:', typeof filesResponse);
          
          // Response yapısını kontrol et
          let existingFiles = [];
          if (filesResponse && typeof filesResponse === 'object') {
            if (Array.isArray(filesResponse)) {
              existingFiles = filesResponse;
            } else if (filesResponse.files && Array.isArray(filesResponse.files)) {
              existingFiles = filesResponse.files;
            } else {
              console.log('📂 Unexpected response structure:', Object.keys(filesResponse));
              // Eğer response bir obje ise ve içinde dosya bilgileri varsa
              const responseKeys = Object.keys(filesResponse);
              for (const key of responseKeys) {
                if (Array.isArray((filesResponse as any)[key])) {
                  existingFiles = (filesResponse as any)[key];
                  console.log('📂 Files found in key:', key);
                  break;
                }
              }
            }
          }
          
          console.log('📂 Extracted files:', existingFiles);
          console.log('📂 Files array length:', existingFiles?.length || 0);
          
          if (Array.isArray(existingFiles) && existingFiles.length > 0) {
            // Yeni yüklenen dosya dışında aynı isimli dosyaları bul
            const oldFiles = existingFiles.filter(existingFile => 
              existingFile && 
              existingFile.name === 'katilimci-listesi.json' && 
              existingFile.key !== file.key
            );
            
            console.log('🗑️ Silinecek eski dosya sayısı:', oldFiles.length);
            
            // Eski dosyaları sil
            if (oldFiles.length > 0) {
              console.log('📋 Eski katılımcı dosyaları siliniyor:', oldFiles.map(f => f.key));
              const fileKeysToDelete = oldFiles.map(f => f.key).filter(key => key); // undefined key'leri filtrele
              
              if (fileKeysToDelete.length > 0) {
                const deleteResult = await getUtapi().deleteFiles(fileKeysToDelete);
                console.log('🗑️ Silme işlemi sonucu:', deleteResult);
                console.log('📋 Eski dosyalar başarıyla silindi');
              } else {
                console.log('📋 Silinecek geçerli key bulunamadı');
              }
            } else {
              console.log('📋 Silinecek eski dosya bulunamadı');
            }
          } else {
            console.log('📂 Dosya listesi alınamadı veya boş');
          }
          
          console.log('📋 Yeni katılımcı listesi aktif:', file.key);
          
          // Dosya içeriğini doğrula
          try {
            const response = await fetch(file.url);
            if (response.ok) {
              const content = await response.text();
              const jsonData = JSON.parse(content);
              console.log('✅ Dosya içeriği doğrulandı, katılımcı sayısı:', Array.isArray(jsonData) ? jsonData.length : 'Array değil');
            }
          } catch (validationError) {
            console.warn('⚠️ Dosya içeriği doğrulanamadı:', validationError);
          }
        }
        
        // Diğer JSON dosyaları için de log
        else if (isJsonFile) {
          console.log('📄 Diğer JSON dosyası yüklendi:', file.name);
        }
        
      } catch (error) {
        console.error('📋 Dosya yönetemi hatası:', error);
        if (error instanceof Error) {
          console.error('📋 Hata detayı:', error.message);
        }
        // Hata olsa bile upload'ı başarılı say
      }
      
      return { 
        uploadedBy: metadata.userId,
        fileUrl: file.url,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        success: true,
        isJson: isJsonFile,
        isParticipantList: file.name === 'katilimci-listesi.json'
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
