import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { LogoConfig } from './types';
import { handleFirestoreError } from './utils';

export const DEFAULT_LOGO_CONFIG: LogoConfig = {
  useCustomLogo: false,
  logoUrl: '',
  companyName: 'RGO ISP RESIUS'
};

/**
 * Fetch the active Logo & Brand Configuration from Firestore.
 */
export async function getLogoConfig(): Promise<LogoConfig> {
  try {
    const configDocRef = doc(db, 'settings', 'logo_config');
    const docSnap = await getDoc(configDocRef);
    if (docSnap.exists()) {
      return { ...DEFAULT_LOGO_CONFIG, ...docSnap.data() } as LogoConfig;
    }
  } catch (error) {
    handleFirestoreError(error, 'get', 'settings/logo_config');
  }
  return DEFAULT_LOGO_CONFIG;
}

/**
 * Persist the Logo & Brand Configuration to Firestore settings.
 */
export async function saveLogoConfig(config: LogoConfig): Promise<boolean> {
  try {
    const configDocRef = doc(db, 'settings', 'logo_config');
    await setDoc(configDocRef, {
      useCustomLogo: config.useCustomLogo,
      logoUrl: config.logoUrl || '',
      companyName: config.companyName || 'RGO ISP RESIUS',
      updatedAt: Timestamp.now()
    });
    return true;
  } catch (error) {
    handleFirestoreError(error, 'write', 'settings/logo_config');
    return false;
  }
}
