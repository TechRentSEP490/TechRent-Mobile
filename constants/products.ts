export type ProductSpec = {
  label: string;
  value: string;
};

export type ProductAccessory = {
  label: string;
  category: string;
};

export type ProductReview = {
  id: string;
  name: string;
  comment: string;
  rating: number;
};

export type RelatedProduct = {
  id: string;
  title: string;
  subtitle: string;
  price: string;
};

export type ProductSummary = {
  id: string;
  name: string;
  model: string;
  price: string;
};

export type ProductDetail = ProductSummary & {
  brand: string;
  status: string;
  specs: ProductSpec[];
  accessories: ProductAccessory[];
  relatedProducts: RelatedProduct[];
  reviews: ProductReview[];
};

export const products: ProductDetail[] = [
  {
    id: '1',
    name: 'Sleek smartphone',
    model: 'SmartPhone X',
    price: '$5/day',
    brand: 'SuperTech',
    status: 'Active',
    specs: [
      { label: 'Display', value: '6.7" OLED, 120Hz' },
      { label: 'Processor', value: 'Octa-core 3.0GHz' },
      { label: 'RAM', value: '12GB' },
      { label: 'Storage', value: '256GB' },
      { label: 'Battery', value: '4500mAh' },
    ],
    accessories: [
      { label: 'Wireless Charger', category: 'Power' },
      { label: 'Protective Case', category: 'Covers' },
      { label: 'USB-C Cable', category: 'Connectivity' },
      { label: 'Noise Cancelling Buds', category: 'Audio' },
    ],
    relatedProducts: [
      { id: 'modelY', title: 'Best Seller', subtitle: 'SmartPhone Y overview', price: '$299' },
      { id: 'modelZ', title: 'New Arrival', subtitle: 'SmartPhone Z overview', price: '$349' },
    ],
    reviews: [
      { id: 'alice', name: 'Alice', comment: 'Amazing product! Totally worth the price.', rating: 5 },
      { id: 'bob', name: 'Bob', comment: 'Great performance. Battery life could be better.', rating: 4 },
    ],
  },
  {
    id: '2',
    name: 'Gaming Laptop',
    model: 'PowerPlay Z',
    price: '$25/day',
    brand: 'ProCompute',
    status: 'In stock',
    specs: [
      { label: 'Display', value: '17" QHD, 165Hz' },
      { label: 'Processor', value: 'Intel i9 13th Gen' },
      { label: 'RAM', value: '32GB' },
      { label: 'Storage', value: '1TB NVMe SSD' },
      { label: 'GPU', value: 'NVIDIA RTX 4080' },
    ],
    accessories: [
      { label: 'RGB Gaming Mouse', category: 'Peripherals' },
      { label: 'Mechanical Keyboard', category: 'Peripherals' },
      { label: 'Cooling Pad', category: 'Cooling' },
      { label: 'Gaming Headset', category: 'Audio' },
    ],
    relatedProducts: [
      { id: 'predator', title: 'Editor Pick', subtitle: 'Predator Elite overview', price: '$399' },
      { id: 'stealth', title: 'New Arrival', subtitle: 'Stealth Pro overview', price: '$429' },
    ],
    reviews: [
      { id: 'cara', name: 'Cara', comment: 'Runs every title on ultra settings.', rating: 5 },
      { id: 'dave', name: 'Dave', comment: 'Amazing performance but a bit heavy.', rating: 4 },
    ],
  },
  {
    id: '3',
    name: 'Tablet 2-in-1',
    model: 'FlexTab 12',
    price: '$10/day',
    brand: 'FlexiTech',
    status: 'Active',
    specs: [
      { label: 'Display', value: '12.4" LCD, 90Hz' },
      { label: 'Processor', value: 'Octa-core 2.4GHz' },
      { label: 'RAM', value: '8GB' },
      { label: 'Storage', value: '128GB' },
      { label: 'Battery', value: '8000mAh' },
    ],
    accessories: [
      { label: 'Stylus Pen', category: 'Input' },
      { label: 'Detachable Keyboard', category: 'Peripherals' },
      { label: 'Travel Sleeve', category: 'Covers' },
      { label: 'USB-C Hub', category: 'Connectivity' },
    ],
    relatedProducts: [
      { id: 'flexTabPlus', title: 'Best Seller', subtitle: 'FlexTab Plus overview', price: '$279' },
      { id: 'flexTabMini', title: 'Budget Pick', subtitle: 'FlexTab Mini overview', price: '$199' },
    ],
    reviews: [
      { id: 'emma', name: 'Emma', comment: 'Perfect for drawing and note taking.', rating: 5 },
      { id: 'frank', name: 'Frank', comment: 'Solid battery life throughout the day.', rating: 4 },
    ],
  },
];

export const productSummaries: ProductSummary[] = products.map(({ id, name, model, price }) => ({
  id,
  name,
  model,
  price,
}));
