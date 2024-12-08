import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Write procedure data to temporary file
    const tempDataFile = path.join(process.cwd(), '..', 'temp_procedure.json');
    await writeFile(tempDataFile, JSON.stringify(data));

    // Run Python script to generate Word document
    const pythonProcess = spawn('python3', [
      'generate_word.py',
      tempDataFile
    ], {
      cwd: path.join(process.cwd(), '..'),
    });

    return new Promise((resolve) => {
      let outputBuffer = Buffer.alloc(0);
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        outputBuffer = Buffer.concat([outputBuffer, data]);
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
        console.error('Python stderr:', data.toString());
      });

      pythonProcess.on('close', async (code) => {
        // Clean up temporary file
        try {
          await unlink(tempDataFile);
        } catch (err) {
          console.error('Error cleaning up temp file:', err);
        }

        if (code !== 0) {
          resolve(
            NextResponse.json(
              { error: 'Word document generation failed', details: errorOutput },
              { status: 500 }
            )
          );
        } else {
          // Return the Word document as a downloadable file
          const response = new NextResponse(outputBuffer);
          response.headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
          response.headers.set('Content-Disposition', 'attachment; filename="procedure.docx"');
          resolve(response);
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