import { NextRequest, NextResponse } from 'next/server';

// Mock database
const products = [
  { id: '1', name: 'Laptop', price: 999, category: 'Electronics', stock: 45, status: 'Available' },
  { id: '2', name: 'Mouse', price: 29, category: 'Electronics', stock: 120, status: 'Available' },
  { id: '3', name: 'Keyboard', price: 79, category: 'Electronics', stock: 0, status: 'Out of Stock' },
  { id: '4', name: 'Monitor', price: 299, category: 'Electronics', stock: 23, status: 'Available' },
  { id: '5', name: 'Desk Chair', price: 199, category: 'Furniture', stock: 15, status: 'Available' },
];

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: products,
      total: products.length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const newProduct = {
      id: String(products.length + 1),
      ...body,
      createdAt: new Date().toISOString(),
    };

    products.push(newProduct);

    return NextResponse.json(
      { success: true, data: newProduct },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create product' },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    const productIndex = products.findIndex((p) => p.id === id);
    if (productIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    products[productIndex] = { ...products[productIndex], ...updateData };

    return NextResponse.json({
      success: true,
      data: products[productIndex],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update product' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const productIndex = products.findIndex((p) => p.id === id);
    if (productIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404 }
      );
    }

    const deletedProduct = products.splice(productIndex, 1);

    return NextResponse.json({
      success: true,
      data: deletedProduct[0],
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to delete product' },
      { status: 400 }
    );
  }
}
