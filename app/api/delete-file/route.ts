// app/api/delete-file/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { fileUrl, fileKey } = await request.json();
    
    if (!fileKey) {
      console.error('🗑️ Dosya key\'i bulunamadı');
      return NextResponse.json({ 
        success: false, 
        error: 'File key gerekli' 
      }, { status: 400 });
    }

    console.log('🗑️ Dosya siliniyor:', fileKey);

    let apiKey = process.env.UPLOADTHING_SECRET;
    if (process.env.UPLOADTHING_TOKEN) {
      try {
        const decoded = JSON.parse(Buffer.from(process.env.UPLOADTHING_TOKEN, 'base64').toString('utf-8'));
        apiKey = decoded.apiKey;
      } catch (e) {
        console.error("UploadThing token parse hatası:", e);
      }
    }

    // UploadThing'den dosyayı sil
    const response = await fetch('https://api.uploadthing.com/v6/deleteFiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Uploadthing-Api-Key': apiKey || '',
      },
      body: JSON.stringify({
        fileKeys: [fileKey]
      }),
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('🗑️ UploadThing silme hatası:', response.status, responseData);
      return NextResponse.json({ 
        success: false, 
        error: 'UploadThing silme hatası',
        details: responseData 
      }, { status: response.status });
    }

    console.log('🗑️ Dosya başarıyla silindi:', fileKey);
    
    return NextResponse.json({ 
      success: true,
      deletedKey: fileKey,
      response: responseData
    });

  } catch (error) {
    console.error('🗑️ delete-file API hatası:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Server hatası',
      details: error instanceof Error ? error.message : 'Bilinmeyen hata'
    }, { status: 500 });
  }
}
