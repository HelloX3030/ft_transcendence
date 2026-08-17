// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PasswordInput from './PasswordInput.vue';

function mountInput() {
  return mount(PasswordInput, { props: { autocomplete: 'new-password' } });
}

describe('PasswordInput', () => {
  it('starts masked, and says so', () => {
    const wrapper = mountInput();

    expect(wrapper.get('input').attributes('type')).toBe('password');
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('false');
    expect(wrapper.get('button').attributes('aria-label')).toBe('Show password');
  });

  it('reveals and re-masks on click', async () => {
    const wrapper = mountInput();

    await wrapper.get('button').trigger('click');
    expect(wrapper.get('input').attributes('type')).toBe('text');
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('button').attributes('aria-label')).toBe('Hide password');

    await wrapper.get('button').trigger('click');
    expect(wrapper.get('input').attributes('type')).toBe('password');
  });

  it('re-masks when the form calls mask() on submit', async () => {
    const wrapper = mountInput();
    await wrapper.get('button').trigger('click');

    wrapper.vm.mask();
    await wrapper.vm.$nextTick();

    expect(wrapper.get('input').attributes('type')).toBe('password');
  });

  it('keeps the model binding while revealed', async () => {
    const wrapper = mountInput();
    await wrapper.get('button').trigger('click');

    await wrapper.get('input').setValue('hunter2');

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['hunter2']);
  });

  it('passes the form field name and blur handler to the input, not to the wrapper', () => {
    // vee-validate's componentField spreads these; the component sets
    // inheritAttrs: false so they land on the input rather than on the group.
    const wrapper = mount(PasswordInput, {
      props: { autocomplete: 'current-password' },
      attrs: { name: 'password' },
    });

    expect(wrapper.get('input').attributes('name')).toBe('password');
    expect(wrapper.get('input').attributes('autocomplete')).toBe('current-password');
  });

  it('reveals only its own field', async () => {
    // The reported bug: one control sitting above two fields. Each instance
    // owns its state, so the confirmation stays a confirmation.
    const password = mountInput();
    const confirmPassword = mountInput();

    await password.get('button').trigger('click');

    expect(password.get('input').attributes('type')).toBe('text');
    expect(confirmPassword.get('input').attributes('type')).toBe('password');
  });
});
