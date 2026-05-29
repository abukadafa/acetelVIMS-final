import jsPDF from 'jspdf';

export async function getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function drawLetterhead(doc: jsPDF, title: string) {
  try {
    const nounLogo = await getBase64ImageFromUrl('/logo-noun.png');
    const acetelLogo = await getBase64ImageFromUrl('/logo-acetel.png');

    // Add NOUN Logo (Left)
    doc.addImage(nounLogo, 'PNG', 14, 10, 24, 24);
    
    // Add ACETEL Logo (Right)
    doc.addImage(acetelLogo, 'PNG', doc.internal.pageSize.width - 38, 10, 24, 24);

    // Add Centered Text
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(10, 92, 54); // VITE_THEME_PRIMARY (#0a5c36)
    const pageWidth = doc.internal.pageSize.width;
    doc.text('NATIONAL OPEN UNIVERSITY OF NIGERIA', pageWidth / 2, 18, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text('Africa Centre of Excellence on Technology Enhanced Learning', pageWidth / 2, 25, { align: 'center' });
    
    // Document Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(title, pageWidth / 2, 34, { align: 'center' });
    
    // Add a divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 38, pageWidth - 14, 38);

  } catch (err) {
    console.error('Failed to draw letterhead', err);
    // Fallback if images fail to load
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('NATIONAL OPEN UNIVERSITY OF NIGERIA', doc.internal.pageSize.width / 2, 18, { align: 'center' });
    doc.setFontSize(14);
    doc.text(title, doc.internal.pageSize.width / 2, 28, { align: 'center' });
  }
}
