/**
 * Initialization for Firebase Admin SDK and Vertex AI.
 *
 * In Cloud Functions, the Admin SDK is auto-initialized by the Functions
 * Framework, so we only need to create Firestore/Auth handles.
 * For local emulation, we rely on Application Default Credentials (ADC).
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { VertexAI } from '@google-cloud/vertexai';

// ── Firebase Admin (auto-initialized in Cloud Functions) ───────────

let adminDb: any;

try {
    if (getApps().length === 0) {
        // In Cloud Functions, ADC is used automatically.
        // Locally, set GOOGLE_APPLICATION_CREDENTIALS or use gcloud auth.
        initializeApp();
    }
    adminDb = getFirestore();
    console.log('✅ Firebase Admin initialized (Firestore ready)');
} catch (error: any) {
    console.error('Firebase Admin initialization failed:', error.message);
    adminDb = undefined;
}

// ── Vertex AI ───────────────────────────────────────────────────────

let projectId = process.env.GOOGLE_CLOUD_PROJECT || 'eduaiplatform-39fe9';
let location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

let vertexAI: VertexAI | undefined;
let generativeModel: any;
let geminiAvailable = false;

try {
    vertexAI = new VertexAI({ project: projectId, location: location });
    const modelName = process.env.VERTEX_AI_MODEL || 'gemini-1.5-flash';
    generativeModel = vertexAI.preview.getGenerativeModel({ model: modelName });
    geminiAvailable = true;
    console.log(`✅ Vertex AI Gemini initialized: ${modelName} (${projectId}/${location})`);
} catch (error: any) {
    console.warn('⚠️ Vertex AI initialization failed (Gemini features will use fallback logic):', error.message);
}

export { adminDb, getAuth, FieldValue, generativeModel, geminiAvailable, projectId, location };
