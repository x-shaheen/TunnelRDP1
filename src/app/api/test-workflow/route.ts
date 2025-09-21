import { NextRequest, NextResponse } from 'next/server';
import { generateWorkflowContent } from '@/utils/workflow-templates';

export async function GET(request: NextRequest) {
  try {
    // Generate a test workflow for Ngrok
    const workflowContent = generateWorkflowContent('ngrok', undefined, true);
    
    // Check if the enhanced RDP configuration is present
    const hasEnhancedRDP = workflowContent.includes('Enhanced RDP Configuration');
    const hasNLADisabled = workflowContent.includes('Network Level Authentication disabled');
    const hasSecurityLayer = workflowContent.includes('SecurityLayer');
    const hasServiceRestart = workflowContent.includes('Restart-Service -Name "TermService"');
    
    // Extract the RDP configuration section
    const rdpConfigMatch = workflowContent.match(/Enhanced RDP Configuration[\s\S]*?catch \{[\s\S]*?\}/);
    const rdpConfigSection = rdpConfigMatch ? rdpConfigMatch[0] : 'Not found';
    
    return NextResponse.json({
      success: true,
      analysis: {
        hasEnhancedRDP,
        hasNLADisabled,
        hasSecurityLayer,
        hasServiceRestart,
        workflowLength: workflowContent.length
      },
      rdpConfigSection: rdpConfigSection.substring(0, 1000) + (rdpConfigSection.length > 1000 ? '...' : ''),
      fullWorkflow: workflowContent.substring(0, 2000) + (workflowContent.length > 2000 ? '...' : ''),
      timestamp: Date.now()
    });
    
  } catch (error: any) {
    console.error('Error testing workflow generation:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    }, { status: 500 });
  }
}
