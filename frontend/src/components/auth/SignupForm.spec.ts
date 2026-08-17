// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('@/api/endpoints/auth', () => ({
  authApi: { register: vi.fn().mockResolvedValue(undefined), googleUrl: () => '' },
}));
vi.mock('@/api/endpoints/user', () => ({ userApi: { getMe: vi.fn().mockResolvedValue(null) } }));

import SignupForm from './SignupForm.vue';

/**
 * The reported bug lived across two fields, so it is only visible in a form
 * that has two of them.
 */
describe('SignupForm password fields', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('reveals the password without revealing the confirmation', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    });
    await router.push('/');
    await router.isReady();

    const wrapper = mount(SignupForm, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.findAll('button[aria-label="Show password"]')).toHaveLength(2);

    // `get` takes the first match, which is the one above "Password".
    await wrapper.get('button[aria-label="Show password"]').trigger('click');

    const passwordFields = wrapper.findAll('input[autocomplete="new-password"]');
    expect(passwordFields.map((f) => f.attributes('type'))).toEqual(['text', 'password']);
  });
});
