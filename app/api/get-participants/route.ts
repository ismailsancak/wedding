import { NextRequest, NextResponse } from 'next/server';
import { UTApi } from 'uploadthing/server';

export const dynamic = 'force-dynamic';

const utapi = new UTApi();

export async function GET(request: NextRequest) {
  try {
    console.log('📋 get-participants API çağrıldı');
    
    // Cache'i bypass etmek için headers ekle
    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    // UploadThing'den tüm dosyaları al
    const filesResponse = await utapi.listFiles({
      limit: 1000, // Limit ekle
    });
    
    console.log('📋 UploadThing API response type:', typeof filesResponse);
    
    // Response yapısını kontrol et
    let files = [];
    if (filesResponse && typeof filesResponse === 'object') {
      if (Array.isArray(filesResponse)) {
        files = filesResponse;
      } else if (filesResponse.files && Array.isArray(filesResponse.files)) {
        files = filesResponse.files;
      } else {
        console.log('📋 Unexpected response structure:', Object.keys(filesResponse));
        const responseKeys = Object.keys(filesResponse);
        for (const key of responseKeys) {
          if (Array.isArray((filesResponse as any)[key])) {
            files = (filesResponse as any)[key];
            console.log('📋 Files found in key:', key);
            break;
          }
        }
      }
    }
    
    console.log('📋 Total files found:', files?.length || 0);
    
    if (!Array.isArray(files) || files.length === 0) {
      console.log('📋 No files found');
      return NextResponse.json({ 
        participants: [],
        fileKey: null,
        debug: {
          message: 'No files found',
          responseType: typeof filesResponse
        }
      }, { headers });
    }
    
    // *** ÖNEMLİ DEĞİŞİKLİK: TÜM katılımcı dosyalarını bul ve EN SONUNCUsunu seç ***
    const participantFiles = files.filter(file => 
      file && file.name && (
        file.name === 'katilimci-listesi.json' || 
        file.name.startsWith('katilimci-listesi-') ||
        file.name.includes('katilimci-listesi')
      )
    );
    
    console.log('📋 Katılımcı dosyaları bulundu:', participantFiles.length);
    participantFiles.forEach((file, index) => {
      console.log(`📋 Katılımcı dosyası ${index + 1}:`, {
        name: file.name,
        key: file.key,
        uploadedAt: file.uploadedAt || 'No date'
      });
    });
    
    if (participantFiles.length === 0) {
      console.log('📋 Hiç katılımcı dosyası bulunamadı');
      return NextResponse.json({ 
        participants: [],
        fileKey: null,
        debug: {
          message: 'No participant files found',
          availableFiles: files.map(f => f?.name || 'unnamed').slice(0, 10)
        }
      }, { headers });
    }
    
    // *** EN SON YÜKLENEN DOSYAYI SEÇ (uploadedAt'e göre) ***
    const latestParticipantFile = participantFiles.reduce((latest, current) => {
      if (!latest) return current;
      
      const latestDate = new Date(latest.uploadedAt || 0);
      const currentDate = new Date(current.uploadedAt || 0);
      
      return currentDate > latestDate ? current : latest;
    });
    
    console.log('📋 En son katılımcı dosyası seçildi:', {
      name: latestParticipantFile.name,
      key: latestParticipantFile.key,
      uploadedAt: latestParticipantFile.uploadedAt
    });
    
    // Dosya key'ini kontrol et
    if (!latestParticipantFile.key) {
      throw new Error('Dosya key\'i bulunamadı');
    }
    
    // Dosya URL'sini oluştur
    const fileUrl = `https://utfs.io/f/${latestParticipantFile.key}`;
    console.log('📋 Dosya URL\'si:', fileUrl);
    
    // Dosyayı indir ve içeriğini oku - Cache bypass ekle
    const response = await fetch(fileUrl, {
      cache: 'no-cache',
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
    
    console.log('📋 Fetch response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }
    
    const responseText = await response.text();
    console.log('📋 Ham dosya içeriği (ilk 200 karakter):', responseText.substring(0, 200));
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('📋 JSON parse hatası:', parseError);
      throw new Error('Dosya geçerli JSON formatında değil');
    }
    
    console.log('📋 Parse edilmiş veri:', {
      type: typeof data,
      isArray: Array.isArray(data),
      hasParticipants: data.participants ? true : false,
      participantCount: data.participants ? data.participants.length : 0
    });
    
    // *** Gerçek katılımcı sayısını logla ***
    const participants = data.participants || [];
    console.log('📋 Gerçek katılımcı listesi:', participants);
    console.log('📋 Katılımcı sayısı:', participants.length);
    
    return NextResponse.json({ 
      participants: participants,
      fileKey: latestParticipantFile.key, // *** EN SON DOSYANIN KEY'İ ***
      lastUpdated: data.lastUpdated || null,
      totalCount: participants.length,
      debug: {
        fileFound: true,
        fileName: latestParticipantFile.name,
        fileKey: latestParticipantFile.key,
        uploadedAt: latestParticipantFile.uploadedAt,
        participantCount: participants.length,
        allParticipantFiles: participantFiles.map(f => ({
          name: f.name,
          key: f.key,
          uploadedAt: f.uploadedAt
        }))
      }
    }, { headers }); // *** CACHE BYPASS HEADERS ***
    
  } catch (error) {
    console.error('📋 get-participants API hatası:', error);
    
    if (error instanceof Error) {
      console.error('📋 Hata mesajı:', error.message);
      console.error('📋 Hata stack:', error.stack);
    }
    
    return NextResponse.json(
      { 
        error: 'Katılımcı listesi alınamadı', 
        details: error instanceof Error ? error.message : 'Bilinmeyen hata',
        participants: [],
        fileKey: null
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      }
    );
  }
}
