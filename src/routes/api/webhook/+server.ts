import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Inkbox } from '@inkbox/sdk';

// Environment variables for configuration
const INKBOX_API_KEY = process.env.INKBOX_API_KEY;
const MY_CELL_PHONE = process.env.MY_CELL_PHONE;

if (!INKBOX_API_KEY || !MY_CELL_PHONE) {
    console.error('Missing required environment variables: INKBOX_API_KEY or MY_CELL_PHONE');
}

// Initialize the Inkbox SDK
const inkbox = new Inkbox({ apiKey: INKBOX_API_KEY || '' });

export const POST: RequestHandler = async ({ request }) => {
    try {
        const payload = await request.json();
        
        // Extract subject and body_text from the Inkbox Email webhook payload
        const { subject, body_text } = payload;
        
        if (!subject || !body_text) {
            return json({ message: 'Missing subject or body_text in payload' }, { status: 400 });
        }

        // Case-insensitive "URGENT" check
        if (!subject.toLowerCase().includes('urgent')) {
            console.log(`Ignored: Not urgent. Subject: "${subject}"`);
            return json({ message: 'Ignored: Not urgent' }, { status: 200 });
        }

        console.log(`Urgent incident detected! Subject: "${subject}". Triggering voice pager...`);

        // Get or initialize the persistent identity
        const identity = await inkbox.getIdentity('voice-pager-agent');
        
        // Initiate the outbound call
        // Note: According to the requirement, we pass the body_text for the built-in TTS engine.
        // We use the signature confirmed by the user, adapting to TypeScript camelCase.
        const call = await identity.placeCall({
            toNumber: MY_CELL_PHONE || '',
            // If your SDK version requires a websocket for audio, use:
            // clientWebsocketUrl: process.env.AGENT_WEBSOCKET_URL || 'wss://your-agent.example.com/ws',
            // Pass the text to be read by the built-in TTS engine
            text: body_text 
        });

        console.log('Call status:', call.status);
        if (call.rateLimit) {
            console.log('Calls remaining:', call.rateLimit.callsRemaining);
        }

        return json({ 
            message: 'Voice pager triggered successfully',
            callId: call.id,
            status: call.status 
        }, { status: 200 });

    } catch (err: any) {
        console.error('CRITICAL: Voice Pager failed:', err);
        return json({ 
            error: 'Failed to process webhook or trigger call',
            details: err.message 
        }, { status: 500 });
    }
};
