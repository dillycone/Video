import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, access } from 'fs/promises';
import path from 'path';
import { constants } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const mode = formData.get('mode') as string || 'keyframes'; // 'keyframes' or 'scenes'
    const numFrames = parseInt(formData.get('numFrames') as string || '5');
    const threshold = parseFloat(formData.get('threshold') as string || '30.0');
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log('Received file:', {
      name: file.name,
      type: file.type,
      size: file.size
    });

    // Save the uploaded file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = path.join(process.cwd(), '..', file.name);
    await writeFile(tempFilePath, buffer);

    // Verify file was saved
    try {
      await access(tempFilePath, constants.R_OK);
      console.log('File saved successfully:', tempFilePath);
    } catch (err) {
      console.error('File not accessible after save:', err);
      return NextResponse.json(
        { error: 'Failed to save video file' },
        { status: 500 }
      );
    }

    // Build Python script arguments
    const pythonArgs = [
      'extract_frames.py',
      '--mode', mode,
      '--num-frames', numFrames.toString(),
      '--threshold', threshold.toString(),
      tempFilePath
    ];

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

      pythonProcess.on('close', (code) => {
        console.log('Python process exited with code:', code);
        
        // Clean up temporary files
        spawn('rm', [tempFilePath], {
          cwd: path.join(process.cwd(), '..'),
        });

        if (code !== 0) {
          resolve(
            NextResponse.json(
              { error: 'Frame extraction failed', details: errorOutput },
              { status: 500 }
            )
          );
        } else {
          try {
            // Parse the JSON output from Python
            const frames = JSON.parse(output);
            console.log('Successfully extracted frames:', frames.length);
            resolve(
              NextResponse.json(
                { frames },
                { status: 200 }
              )
            );
          } catch (parseError) {
            console.error('Failed to parse Python output:', parseError);
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