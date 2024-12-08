import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, access, unlink } from 'fs/promises';
import path from 'path';
import { constants } from 'fs';

export async function POST(request: Request) {
  try {
    // Check if the request is JSON or FormData
    const contentType = request.headers.get('content-type');
    let file: File;
    let mode = 'timestamps';
    let numFrames = 5;
    let threshold = 30.0;
    let timestamps: any[] = [];
    let targetSize: any = null;

    if (contentType?.includes('application/json')) {
      const data = await request.json();
      timestamps = data.timestamps || [];
      targetSize = data.targetSize;
      
      // For JSON requests, we need the video file from the timestamps
      if (timestamps.length === 0) {
        return NextResponse.json(
          { error: 'No timestamps provided' },
          { status: 400 }
        );
      }
    } else {
      // Handle FormData as before
      const formData = await request.formData();
      file = formData.get('file') as File;
      mode = formData.get('mode') as string || 'keyframes';
      numFrames = parseInt(formData.get('numFrames') as string || '5');
      threshold = parseFloat(formData.get('threshold') as string || '30.0');
    }

    // Build Python script arguments
    const pythonArgs = [
      'extract_frames.py',
      '--mode', mode
    ];

    if (mode === 'keyframes') {
      pythonArgs.push('--num-frames', numFrames.toString());
    } else if (mode === 'scenes') {
      pythonArgs.push('--threshold', threshold.toString());
    } else if (mode === 'timestamps') {
      // Create a temporary JSON file for timestamps
      const timestampsWithSize = timestamps.map(mark => ({
        ...mark,
        target_size: targetSize ? [targetSize.width, targetSize.height] : undefined
      }));
      
      const timestampFile = path.join(process.cwd(), '..', 'temp_timestamps.json');
      await writeFile(timestampFile, JSON.stringify(timestampsWithSize));
      pythonArgs.push('--timestamps', timestampFile);
    }

    console.log('Running Python script with args:', pythonArgs);

    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', pythonArgs, {
        cwd: path.join(process.cwd(), '..'),
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
        console.log('Python stdout:', data.toString());
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Python stderr:', data.toString());
      });

      pythonProcess.on('close', async (code) => {
        // Clean up temporary files
        if (mode === 'timestamps') {
          try {
            await unlink(path.join(process.cwd(), '..', 'temp_timestamps.json'));
          } catch (err) {
            console.error('Error cleaning up timestamp file:', err);
          }
        }

        if (code !== 0) {
          resolve(
            NextResponse.json(
              { error: 'Frame extraction failed', details: errorOutput },
              { status: 500 }
            )
          );
        } else {
          try {
            const frames = JSON.parse(output);
            resolve(
              NextResponse.json(
                { frames },
                { status: 200 }
              )
            );
          } catch (parseError) {
            resolve(
              NextResponse.json(
                { error: 'Invalid response format', details: output },
                { status: 500 }
              )
            );
          }
        }
      });
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 