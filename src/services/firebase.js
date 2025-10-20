import { notification } from 'antd'; // Import notification for feedback

class FirebaseService {
  constructor() {
    this.db = null;
    this.auth = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return true;

    try {
      if (typeof window.firebase === 'undefined') {
        throw new Error('Firebase not loaded');
      }

      this.db = window.firebase.firestore();
      this.auth = window.firebase.auth();
      
      this.db.settings({
        cacheSizeBytes: window.firebase.firestore.CACHE_SIZE_UNLIMITED,
        merge: true
      });

      this.initialized = true;
      console.log('Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      return false;
    }
  }

  async getUsers() {
    if (!this.initialized) {
      await this.init();
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
      await this.init();
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
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() // Update timestamp
      });
    } catch (error) {
      console.error('Error resetting user data:', error);
      throw error;
    }
  }
}

export default new FirebaseService();