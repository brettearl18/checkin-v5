import { NextResponse } from 'next/server';
import { populateSampleData } from '@/lib/sample-data';

export async function POST() {
  try {
    await populateSampleData();
    return NextResponse.json({ 
      success: true, 
      message: 'Sample data populated successfully!' 
    });
  } catch (error) {
    console.error('Error populating sample data:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to populate sample data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 