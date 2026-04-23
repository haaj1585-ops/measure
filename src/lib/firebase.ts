import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
  type DocumentData
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
}

export function handleFirestoreError(error: any, operation: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  const errorInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType: operation,
    path: path
  };
  throw new Error(JSON.stringify(errorInfo));
}

// Data conversion helpers
export const measurementConverter = {
  toFirestore(data: any): DocumentData {
    return {
      ...data,
      date: Timestamp.fromDate(new Date(data.date))
    };
  },
  fromFirestore(snapshot: any): any {
    const data = snapshot.data();
    return {
      id: snapshot.id,
      ...data,
      date: data.date.toDate().toISOString()
    };
  }
};

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
