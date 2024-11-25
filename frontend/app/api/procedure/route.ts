import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const pdfFile = formData.get('pdf') as File;
    const customPrompt = formData.get('prompt') as string;
    const model = formData.get('model') as string || 'gemini-1.5-pro-002'; // Default to pro if not specified
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Save the uploaded video file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = path.join(process.cwd(), '..', file.name);
    await writeFile(tempFilePath, buffer);

    // Save the PDF file if provided
    let tempPdfPath = '';
    if (pdfFile) {
      const pdfBytes = await pdfFile.arrayBuffer();
      const pdfBuffer = Buffer.from(pdfBytes);
      tempPdfPath = path.join(process.cwd(), '..', pdfFile.name);
      await writeFile(tempPdfPath, pdfBuffer);
    }

    // If custom prompt provided, save it temporarily
    let tempPromptPath: string;
    if (customPrompt) {
      tempPromptPath = path.join(process.cwd(), '..', 'temp_procedure_prompt.txt');
      await writeFile(tempPromptPath, customPrompt);
    } else {
      // Use the default prompt from frontend/public/prompts directory
      tempPromptPath = path.join('frontend', 'public', 'prompts', 'procedure_from_video_prompt.txt');
      if (pdfFile) {
        tempPromptPath = path.join('frontend', 'public', 'prompts', 'procedure_from_video_prompt_with_additional_context.txt');
      }
    }

    // Build Python script arguments - flags must come before positional arguments
    const pythonArgs = [
      'main.py',
      '--mode', 'procedure',
      '--model', model
    ];
    
    // Add PDF flag if provided
    if (pdfFile) {
      pythonArgs.push('--pdf', tempPdfPath);
    }

    // Add positional arguments last
    pythonArgs.push(tempFilePath, tempPromptPath);

    // Run Python script with the video file path, prompt path, and optional PDF path as arguments
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
        if (pdfFile) {
          filesToRemove.push(tempPdfPath);
        }
        
        spawn('rm', filesToRemove, {
          cwd: path.join(process.cwd(), '..'),
        });

        if (code !== 0) {
          resolve(
            NextResponse.json(
              { error: 'Procedure generation failed', details: errorOutput },
              { status: 500 }
            )
          );
        } else {
          try {
            // Parse the output as JSON
            const procedure = JSON.parse(output);
            resolve(
              NextResponse.json(
                { procedure },
                { status: 200 }
              )
            );
          } catch (parseError) {
            resolve(
              NextResponse.json(
                { error: 'Invalid procedure format', details: output },
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
