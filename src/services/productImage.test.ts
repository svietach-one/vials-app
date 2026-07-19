/**
 * Unit tests — product photo service (img-01). All native modules
 * (expo-image-picker, expo-image-manipulator, expo-file-system) and the upload
 * queue are mocked at the module boundary. Contract under test: cancel and
 * permission-denied return null without side effects; the happy path renders
 * BOTH copies and enqueues exactly one upload entry.
 */
import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import { enqueue } from '@/services/photoUploadQueue';
import { pickAndStoreProductPhoto } from '@/services/productImage';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockSaveAsync = jest.fn(async () => ({ uri: 'file:///cache/out.jpg' }));
const mockRenderAsync = jest.fn(async () => ({ saveAsync: mockSaveAsync }));

jest.mock('expo-image-manipulator', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx: any = {
    renderAsync: () => mockRenderAsync(),
  };
  ctx.resize = jest.fn(() => ctx);
  return {
    SaveFormat: { JPEG: 'jpeg' },
    ImageManipulator: { manipulate: jest.fn(() => ctx) },
  };
});

const mockFileCopy = jest.fn();

jest.mock('expo-file-system', () => ({
  Paths: { document: '/doc' },
  Directory: jest.fn().mockImplementation(() => ({ exists: true, create: jest.fn() })),
  File: jest.fn().mockImplementation((...parts: unknown[]) => ({
    uri: `file:///doc/${String(parts[parts.length - 1])}`,
    exists: false,
    copy: mockFileCopy,
    delete: jest.fn(),
  })),
}));

jest.mock('@/services/photoUploadQueue', () => ({
  enqueue: jest.fn(async () => {}),
  remove: jest.fn(async () => {}),
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('pickAndStoreProductPhoto', () => {
  it('returns null and enqueues nothing when the user cancels', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    const result = await pickAndStoreProductPhoto('p1', 'camera');

    expect(result).toBeNull();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('returns null and enqueues nothing when permission is denied', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false } as never);

    const result = await pickAndStoreProductPhoto('p1', 'camera');

    expect(result).toBeNull();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
  });

  it('renders both copies and enqueues one upload entry on the happy path', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cam.jpg', width: 1200, height: 900 }],
    } as never);

    const result = await pickAndStoreProductPhoto('p1', 'camera');

    expect(result).not.toBeNull();
    expect(result?.localImageUri).toBeTruthy();
    // Two renders (800px display + 1600px upload), two file writes.
    expect(ImageManipulator.manipulate).toHaveBeenCalledTimes(2);
    expect(mockSaveAsync).toHaveBeenCalledTimes(2);
    expect(mockFileCopy).toHaveBeenCalledTimes(2);
    // Exactly one queue entry, keyed to the product with a zero attempt count.
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'p1', attempts: 0, filePath: expect.any(String) }),
    );
  });

  it('reads from the gallery when source is library', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true } as never);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///lib.jpg', width: 800, height: 800 }],
    } as never);

    const result = await pickAndStoreProductPhoto('p2', 'library');

    expect(result?.localImageUri).toBeTruthy();
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});
