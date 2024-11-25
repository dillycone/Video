import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const customPrompt = formData.get('prompt') as string;
    const model = formData.get('model') as string || 'gemini-1.5-pro-002';
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Save the uploaded file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Save to temp location with original filename
    const tempFilePath = path.join(process.cwd(), '..', file.name);
    await writeFile(tempFilePath, buffer);

    // If custom prompt provided, save it temporarily
    let tempPromptPath: string;
    if (customPrompt) {
      tempPromptPath = path.join(process.cwd(), '..', 'temp_prompt.txt');
      await writeFile(tempPromptPath, customPrompt);
    } else {
      // Use default prompt path if no custom prompt
      tempPromptPath = path.join(process.cwd(), '..', 'prompts', 'video_transcription_prompt.txt');
    }

    // Build Python script arguments - flags must come before positional arguments
    const pythonArgs = [
      'main.py',
      '--mode', 'transcribe',
      '--model', model
    ];

    // Add positional arguments last
    pythonArgs.push(tempFilePath, tempPromptPath);

    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', pythonArgs, {
        cwd: path.join(process.cwd(), '..'),
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Python error:', errorOutput);
      });

      pythonProcess.on('close', (code) => {
        // Clean up temporary files
        const filesToRemove = [tempFilePath];
        if (customPrompt) {
          filesToRemove.push(tempPromptPath);
        }
        
        spawn('rm', filesToRemove, {
          cwd: path.join(process.cwd(), '..'),
        });

        if (code !== 0) {
          resolve(
            NextResponse.json(
              { error: 'Transcription failed', details: errorOutput },
              { status: 500 }
            )
          );
        } else {
          try {
            // Parse the JSON output from Python
            const result = JSON.parse(output);
            resolve(
              NextResponse.json(
                { 
                  transcript: result.text,
                  token_usage: result.token_usage 
                },
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
