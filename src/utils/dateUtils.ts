export interface ParsedDate {
  year: number;
  month: number;
  day: number;
  originalFormat: string;
  isValid: boolean;
}

export const dateUtils = {
  parseDate(dateString: string): ParsedDate | null {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }

    const trimmed = dateString.trim();
    if (!trimmed) {
      return null;
    }

    const slashPattern = /^(\d{1,4})[\/](\d{1,2})[\/](\d{1,4})$/;
    const dashPattern = /^(\d{1,4})[-](\d{1,2})[-](\d{1,4})$/;

    let parts: string[] | null = null;
    let separator = '';

    if (slashPattern.test(trimmed)) {
      const match = trimmed.match(slashPattern);
      if (match) {
        parts = [match[1], match[2], match[3]];
        separator = '/';
      }
    } else if (dashPattern.test(trimmed)) {
      const match = trimmed.match(dashPattern);
      if (match) {
        parts = [match[1], match[2], match[3]];
        separator = '-';
      }
    }

    if (!parts || parts.length !== 3) {
      console.warn(`Unable to parse date: ${dateString}`);
      return null;
    }

    const num1 = parseInt(parts[0], 10);
    const num2 = parseInt(parts[1], 10);
    const num3 = parseInt(parts[2], 10);

    let year: number, month: number, day: number;
    let detectedFormat: string;

    if (num1 > 1000) {
      year = num1;
      month = num2;
      day = num3;
      detectedFormat = `YYYY${separator}MM${separator}DD`;
    } else if (num3 > 1000) {
      year = num3;

      if (num1 > 12) {
        day = num1;
        month = num2;
        detectedFormat = `DD${separator}MM${separator}YYYY`;
      } else if (num2 > 12) {
        month = num1;
        day = num2;
        detectedFormat = `MM${separator}DD${separator}YYYY`;
      } else {
        day = num1;
        month = num2;
        detectedFormat = `DD${separator}MM${separator}YYYY`;
      }
    } else {
      console.warn(`Unable to determine year in date: ${dateString}`);
      return null;
    }

    const isValidDate = this.validateDate(year, month, day);

    if (!isValidDate) {
      console.warn(`Invalid date values: ${year}-${month}-${day} from ${dateString}`);
      return null;
    }

    return {
      year,
      month,
      day,
      originalFormat: detectedFormat,
      isValid: true
    };
  },

  validateDate(year: number, month: number, day: number): boolean {
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > 2100) return false;

    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) return false;

    return true;
  },

  toISOFormat(dateString: string): string | null {
    const parsed = this.parseDate(dateString);
    if (!parsed || !parsed.isValid) {
      return null;
    }

    const month = parsed.month.toString().padStart(2, '0');
    const day = parsed.day.toString().padStart(2, '0');

    return `${parsed.year}-${month}-${day}`;
  },

  toDisplayFormat(isoDateString: string, format: 'DD/MM/YYYY' | 'MM/DD/YYYY' = 'DD/MM/YYYY'): string {
    const parsed = this.parseDate(isoDateString);
    if (!parsed || !parsed.isValid) {
      return isoDateString;
    }

    const month = parsed.month.toString().padStart(2, '0');
    const day = parsed.day.toString().padStart(2, '0');

    if (format === 'MM/DD/YYYY') {
      return `${month}/${day}/${parsed.year}`;
    }

    return `${day}/${month}/${parsed.year}`;
  },

  normalizeDate(dateString: string): string | null {
    return this.toISOFormat(dateString);
  },

  compareDates(date1: string, date2: string): number {
    const iso1 = this.toISOFormat(date1);
    const iso2 = this.toISOFormat(date2);

    if (!iso1 || !iso2) {
      return 0;
    }

    return iso1.localeCompare(iso2);
  },

  sortDates(dates: string[], descending: boolean = true): string[] {
    return dates.sort((a, b) => {
      const comparison = this.compareDates(a, b);
      return descending ? -comparison : comparison;
    });
  }
};
