// calendar-utils.ts

// Tarih formatını ICS formatına çevir
const formatDateForICS = (date: Date): string => {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

// Google Calendar URL'i oluştur
export const createGoogleCalendarUrl = (
  title: string,
  startDate: Date,
  endDate: Date,
  location: string,
  description: string
): string => {
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${formatDate(startDate)}/${formatDate(endDate)}`,
    location: location,
    details: description,
    trp: 'false', // Takvim etkinliği olarak işaretle
    sprop: 'website'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

// Apple Calendar (ICS) dosyası oluştur
export const createICSFile = (
  title: string,
  startDate: Date,
  endDate: Date,
  location: string,
  description: string
): string => {
  // 1 gün öncesi için alarm
  const alarmDate = new Date(startDate);
  alarmDate.setDate(alarmDate.getDate() - 1);
  alarmDate.setHours(10, 0, 0, 0); // Sabah 10:00'da hatırlatma

  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Wedding Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${Date.now()}@wedding-calendar.com
DTSTAMP:${formatDateForICS(new Date())}
DTSTART:${formatDateForICS(startDate)}
DTEND:${formatDateForICS(endDate)}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${location}
STATUS:CONFIRMED
TRANSP:OPAQUE
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:${title} - Yarın düğün günü!
TRIGGER:${formatDateForICS(alarmDate)}
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:${title} - 2 saat sonra başlayacak!
TRIGGER:-PT2H
END:VALARM
END:VEVENT
END:VCALENDAR`;

  return icsContent;
};

// ICS dosyasını indirtmek için blob oluştur
export const downloadICSFile = (
  title: string,
  startDate: Date,
  endDate: Date,
  location: string,
  description: string
): void => {
  const icsContent = createICSFile(title, startDate, endDate, location, description);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/\s+/g, '_')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Cihaz tipini tespit et
export const detectDevice = (): 'ios' | 'android' | 'desktop' => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'ios';
  } else if (/android/.test(userAgent)) {
    return 'android';
  } else {
    return 'desktop';
  }
};

// Outlook Calendar URL'i oluştur
export const createOutlookCalendarUrl = (
  title: string,
  startDate: Date,
  endDate: Date,
  location: string,
  description: string
): string => {
  const formatDate = (date: Date) => {
    return date.toISOString();
  };

  const params = new URLSearchParams({
    subject: title,
    startdt: formatDate(startDate),
    enddt: formatDate(endDate),
    location: location,
    body: description,
    allday: 'false',
    uid: `wedding-${Date.now()}`
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
};