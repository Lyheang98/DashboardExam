import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || '';
    const minPrice = parseFloat(searchParams.get('minPrice') || '0') || 0;
    const maxPrice = parseFloat(searchParams.get('maxPrice') || '999999') || 999999;

    const response = await fetch('https://dummyjson.com/products?limit=200', {
      cache: 'no-store',
    });
    const data = await response.json();

    let products = (data.products || []).map((product: any) => ({
      id: product.id,
      name: product.title,
      price: product.price,
      category: product.category,
      stock: product.stock,
      status: product.stock > 0 ? 'Available' : 'Out of Stock',
    }));

    if (query) {
      const lowerQuery = query.toLowerCase();
      products = products.filter((p: any) =>
        p.name.toLowerCase().includes(lowerQuery)
      );
    }

    if (category) {
      products = products.filter((p: any) =>
        p.category.toLowerCase() === category.toLowerCase()
      );
    }

    products = products.filter((p: any) =>
      p.price >= minPrice && p.price <= maxPrice
    );

    return NextResponse.json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    logger.error('Product search failed', 'API/PRODUCTS/SEARCH', error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}
