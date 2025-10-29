import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { notification } from 'antd'; // Import notification for feedback

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

class FirebaseService {
  constructor() {
    if (!firebase.apps.length) {
      try {
        firebase.initializeApp(firebaseConfig);
        console.log('Firebase initialized successfully');
        this.initialized = true;
      } catch (error) {
        console.error('Firebase initialization error:', error);
        this.initialized = false;
        notification.error({
          message: 'Firebase Initialization Failed',
          description: 'Could not connect to Firebase. Please check your configuration and network connection.',
          duration: 0 // Keep open until manually closed
        });
      }
    } else {
      firebase.app(); // if already initialized, use that one
      this.initialized = true;
    }

    this.db = this.initialized ? firebase.firestore() : null;
    this.auth = this.initialized ? firebase.auth() : null;
    
    if(this.db) {
        this.db.settings({
            cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
            merge: true
        });
    }
  }

  async getUsers() {
    if (!this.initialized) {
        const err = new Error('Firebase not initialized');
        console.error('Error fetching users:', err);
        throw err;
    }

    try {
      const snapshot = await this.db.collection('users')
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  async resetUserData(userId) {
    if (!this.initialized) {
        const err = new Error('Firebase not initialized');
        console.error('Error resetting user data:', err);
        throw err;
    }

    try {
      const userRef = this.db.collection('users').doc(userId);
      await userRef.update({
        scannedCodes: [], // Clear scanned codes
        drawingEntries: 0,
        drawingBonusEntries: 0,
        redemptionStatus: {}, // Clear redemption status
        completionTime: null, // Clear completion time
        firstScanDate: null, // Clear first scan date
        updatedAt: firebase.firestore.FieldValue.serverTimestamp() // Update timestamp
      });
    } catch (error) {
      console.error('Error resetting user data:', error);
      throw error;
    }
  }

  async addQRCode(qr) {
    if (!this.initialized) {
      const err = new Error('Firebase not initialized');
      console.error('Error adding QR code:', err);
      throw err;
    }

    const { code, name, description, active } = qr || {};
    if (!code) {
      throw new Error('QR code value is required');
    }

    try {
      const docRef = this.db.collection('valid_codes').doc(code);
      await docRef.set({
        name: name || '',
        description: description || '',
        active: active !== false,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error('Error adding QR code:', error);
      throw error;
    }
  }

  async deleteQRCode(code) {
    if (!this.initialized) {
      const err = new Error('Firebase not initialized');
      console.error('Error deleting QR code:', err);
      throw err;
    }
    if (!code) {
      throw new Error('QR code value is required');
    }

    try {
      await this.db.collection('valid_codes').doc(code).delete();
    } catch (error) {
      console.error('Error deleting QR code:', error);
      throw error;
    }
  }
}

export default new FirebaseService();