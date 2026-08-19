import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { App } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  updateCurrentUserProfile,
  uploadCurrentUserAvatar,
} from '@/services/film-fusion';
import UserProfilePage from './index';

const profileState = vi.hoisted(() => ({
  currentUser: {
    id: 1,
    username: 'xifo',
    nickname: '小熊猫',
    avatar: '',
  } as API.User,
  setCurrentUser: vi.fn(),
}));

vi.mock('@/contexts/app-state', () => ({
  useAppState: () => profileState,
}));

vi.mock('@/services/film-fusion', () => ({
  updateCurrentUserProfile: vi.fn(),
  uploadCurrentUserAvatar: vi.fn(),
}));

describe('UserProfilePage', () => {
  const updateProfileMock = vi.mocked(updateCurrentUserProfile);
  const uploadAvatarMock = vi.mocked(uploadCurrentUserAvatar);

  beforeEach(() => {
    updateProfileMock.mockResolvedValue({
      code: 0,
      message: '用户资料更新成功',
      data: { ...profileState.currentUser, nickname: '新的昵称' },
    });
    uploadAvatarMock.mockResolvedValue({
      code: 0,
      message: '头像更新成功',
      data: {
        user: {
          ...profileState.currentUser,
          avatar: '/api/public-assets/avatar/avatar-test.png',
        },
        width: 128,
        height: 128,
        size: 1024,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('saves the trimmed nickname and refreshes shared user state', async () => {
    render(
      <App>
        <UserProfilePage />
      </App>,
    );

    const nicknameInput = screen.getByRole('textbox', { name: '昵称' });
    expect((nicknameInput as HTMLInputElement).value).toBe('小熊猫');

    fireEvent.change(nicknameInput, { target: { value: '  新的昵称  ' } });
    fireEvent.click(screen.getByRole('button', { name: /保存资料/ }));

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({ nickname: '新的昵称' });
    });
    expect(profileState.setCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({ nickname: '新的昵称' }),
    );
  });

  it('uploads a supported image and refreshes the avatar immediately', async () => {
    const { container } = render(
      <App>
        <UserProfilePage />
      </App>,
    );

    const fileInput =
      container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).toBeTruthy();
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    fireEvent.change(fileInput as HTMLInputElement, {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(uploadAvatarMock).toHaveBeenCalledWith(file, 'avatar.png');
    });
    expect(profileState.setCurrentUser).toHaveBeenCalledWith(
      expect.objectContaining({
        avatar: '/api/public-assets/avatar/avatar-test.png',
      }),
    );
  });
});
