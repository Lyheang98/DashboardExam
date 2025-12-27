/**
 * Provinces Constants
 * 
 * Centralized province data storage
 * Hardcoded list of all provinces in Cambodia
 */

export interface Province {
  province_id: string;
  province_name: string;
}

/**
 * Hardcoded list of all provinces in Cambodia
 * Format: { id: string, name: string } mapped to { province_id: string, province_name: string }
 */
export const PROVINCES: Province[] = [
  { province_id: "1", province_name: "ខេត្តបន្ទាយមានជ័យ" },
  { province_id: "2", province_name: "ខេត្តបាត់ដំបង" },
  { province_id: "3", province_name: "ខេត្តកំពង់ចាម" },
  { province_id: "4", province_name: "ខេត្តកំពង់ឆ្នាំង" },
  { province_id: "5", province_name: "ខេត្តកំពង់ស្ពឺ" },
  { province_id: "6", province_name: "ខេត្តកំពង់ធំ" },
  { province_id: "7", province_name: "ខេត្តកំពត" },
  { province_id: "8", province_name: "ខេត្តកណ្ដាល" },
  { province_id: "9", province_name: "ខេត្តកោះកុង" },
  { province_id: "10", province_name: "ខេត្តក្រចេះ" },
  { province_id: "11", province_name: "ខេត្តមណ្ឌលគិរី" },
  { province_id: "12", province_name: "រាជធានីភ្នំពេញ" },
  { province_id: "13", province_name: "ខេត្តព្រះវិហារ" },
  { province_id: "14", province_name: "ខេត្តព្រៃវែង" },
  { province_id: "15", province_name: "ខេត្តពោធិ៍សាត់" },
  { province_id: "16", province_name: "ខេត្តរតនគិរី" },
  { province_id: "17", province_name: "ខេត្តសៀមរាប" },
  { province_id: "18", province_name: "ខេត្តព្រះសីហនុ" },
  { province_id: "19", province_name: "ខេត្តស្ទឹងត្រែង" },
  { province_id: "20", province_name: "ខេត្តស្វាយរៀង" },
  { province_id: "21", province_name: "ខេត្តតាកែវ" },
  { province_id: "22", province_name: "ខេត្តកែប" },
  { province_id: "23", province_name: "ខេត្តប៉ៃលិន" },
  { province_id: "24", province_name: "ខេត្តឧត្តរមានជ័យ" },
  { province_id: "25", province_name: "ខេត្តត្បូងឃ្មុំ" },
];

/**
 * Get provinces (synchronous)
 * Returns the hardcoded provinces array
 */
export function getProvinces(): Province[] {
  return PROVINCES;
}

/**
 * Get province by ID
 */
export function getProvinceById(id: string): Province | undefined {
  return PROVINCES.find(p => p.province_id === id);
}

/**
 * Get province by name
 */
export function getProvinceByName(name: string): Province | undefined {
  return PROVINCES.find(p => p.province_name === name);
}

