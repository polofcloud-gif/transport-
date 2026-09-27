// ============================================================
// utils.js — Utility functions for the Transport Invoice App
// ============================================================

/**
 * Convert a number to Indian English words.
 * Supports values up to 99,99,99,999 (99 crore).
 * @param {number} num
 * @returns {string} e.g. "Twenty Five Thousand"
 */
export function numberToWords(num) {
  if (num === 0) return 'Zero';
  if (num < 0) return 'Minus ' + numberToWords(-num);

  num = Math.round(num);

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function twoDigits(n) {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }

  function threeDigits(n) {
    if (n >= 100) {
      return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
    }
    return twoDigits(n);
  }

  // Indian numbering: ones → thousands → lakhs → crores
  let result = '';
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const remainder = num;

  if (crore) result += threeDigits(crore) + ' Crore ';
  if (lakh) result += twoDigits(lakh) + ' Lakh ';
  if (thousand) result += twoDigits(thousand) + ' Thousand ';
  if (remainder) result += threeDigits(remainder);

  return result.trim();
}

/**
 * Format a number as Indian Rupee currency string.
 * Uses Indian grouping: 1,00,000
 * @param {number} num
 * @returns {string} e.g. "₹25,000"
 */
export function formatCurrency(num) {
  if (num === undefined || num === null || isNaN(num)) return '₹0';
  const n = Number(num);
  // Use toLocaleString with en-IN for Indian grouping
  return '₹' + n.toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/**
 * Generate the next invoice number in format STC-XXXX.
 * @param {number} counter — current counter value (0-based, will be incremented)
 * @returns {string} e.g. "STC-0001"
 */
export function generateInvoiceNumber(counter) {
  const num = counter + 1;
  return 'STC-' + String(num).padStart(4, '0');
}

/**
 * Format a Date object as DD/MM/YYYY.
 * @param {Date|string} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format a Date as YYYY-MM-DD for <input type="date">.
 * @param {Date|string} date
 * @returns {string}
 */
export function toInputDate(date) {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

/**
 * Generate a simple unique ID.
 * @returns {string}
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

/**
 * Parse a currency input string to a number.
 * Strips ₹, commas, spaces.
 * @param {string|number} val
 * @returns {number}
 */
export function parseCurrency(val) {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return Number(String(val).replace(/[₹,\s]/g, '')) || 0;
}
