// ============================================================
// invoice-pdf.js — PDF Generation using html2pdf.js
// ============================================================

/**
 * Generate and download a PDF from the rendered invoice element.
 * @param {string} invoiceNumber
 * @returns {Promise<void>}
 */
export async function generatePDF(invoiceNumber) {
  const element = document.getElementById('invoice-page');

  if (!element) {
    alert('Please preview the invoice first.');
    return;
  }

  if (typeof html2pdf === 'undefined') {
    alert('PDF library is loading. Please try again in a moment.');
    return;
  }

  const filename = `${invoiceNumber || 'Invoice'}_ShivShakti.pdf`;

  const opt = {
    margin: 0,
    filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      letterRendering: true,
      scrollX: 0,
      scrollY: 0,
      backgroundColor: '#ffffff'
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait',
      compress: true
    },
    pagebreak: { mode: ['css'] }
  };

  try {
    const worker = html2pdf().set(opt).from(element).toPdf();

    await worker.get('pdf').then((pdf) => {
      while (pdf.internal.getNumberOfPages() > 1) {
        pdf.deletePage(pdf.internal.getNumberOfPages());
      }
    });

    await worker.save();
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert('Failed to generate PDF. Please try again.');
  }
}

/**
 * Print the invoice using the browser's print dialog.
 */
export function printInvoice() {
  const element = document.getElementById('invoice-page');

  if (!element) {
    alert('Please preview the invoice first.');
    return;
  }

  window.print();
}