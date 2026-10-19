/**
 * Отправка заявок без перезагрузки страницы.
 * Без JavaScript форма уходит обычным POST и сервер отвечает переходом на страницу результата.
 */
import { site } from '../config/site';
import { zonedNow } from '../lib/hours';
import type { FieldErrors, ValidationResult } from '../lib/validation';

type Validator = (input: Record<string, unknown>, now: ReturnType<typeof zonedNow>) => ValidationResult<object>;

interface Options {
  validate: Validator;
  /** Собрать данные формы (по умолчанию — все поля) */
  collect?: (form: HTMLFormElement) => Record<string, unknown>;
  /** Заполнить экран успеха */
  onSuccess: (id: string, data: Record<string, unknown>) => void;
}

const PHONE_TEXT = `${site.phone.local} (${site.phone.international})`;

const MESSAGES: Record<string, string> = {
  not_configured: `Онлайн-приём заявок сейчас недоступен. Пожалуйста, позвоните нам: ${PHONE_TEXT} — администратор всё оформит по телефону.`,
  failed: `Не получилось передать заявку администратору. Попробуйте ещё раз через минуту или позвоните: ${PHONE_TEXT}.`,
  network: `Нет связи с сервером. Проверьте интернет и попробуйте снова — или позвоните: ${PHONE_TEXT}.`,
  rate_limited: `Слишком много заявок подряд. Попробуйте через несколько минут или позвоните: ${PHONE_TEXT}.`,
  unknown: `Что-то пошло не так. Попробуйте ещё раз или позвоните: ${PHONE_TEXT}.`,
};

export function setupRequestForm(form: HTMLFormElement, opts: Options) {
  // Свою проверку показываем по-человечески — встроенные всплывашки браузера отключаем
  form.noValidate = true;
  const notice = form.querySelector<HTMLElement>('[data-form-error]');
  const submit = form.querySelector<HTMLButtonElement>('[type="submit"]');
  const submitLabel = submit?.querySelector<HTMLElement>('[data-label]');
  const fields = new Map<string, HTMLElement>();
  form.querySelectorAll<HTMLElement>('[data-field]').forEach((f) => fields.set(f.dataset.field!, f));
  let touched = false;

  const collect = opts.collect ?? ((f: HTMLFormElement) => {
    const data: Record<string, unknown> = Object.fromEntries(new FormData(f).entries());
    const consent = f.querySelector<HTMLInputElement>('[name="consent"]');
    if (consent) data.consent = consent.checked;
    return data;
  });

  function showErrors(errors: FieldErrors) {
    fields.forEach((field, name) => {
      const msg = errors[name];
      const errorEl = field.querySelector<HTMLElement>('.field__error');
      const controls = field.querySelectorAll<HTMLElement>('input:not([type="hidden"]), select, textarea');
      field.classList.toggle('has-error', Boolean(msg));
      if (errorEl) errorEl.textContent = msg ?? '';
      controls.forEach((c) => {
        if (msg) c.setAttribute('aria-invalid', 'true');
        else c.removeAttribute('aria-invalid');
        const ids = new Set((c.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean));
        if (errorEl?.id) ids.add(errorEl.id);
        c.setAttribute('aria-describedby', [...ids].join(' '));
      });
    });
  }

  function focusFirstError() {
    const first = form.querySelector<HTMLElement>('.has-error input:not([type="hidden"]), .has-error select, .has-error textarea');
    first?.focus();
  }

  function setNotice(text: string | null) {
    if (!notice) return;
    notice.hidden = !text;
    const p = notice.querySelector('p');
    if (p) p.textContent = text ?? '';
  }

  function setLoading(on: boolean) {
    form.classList.toggle('is-loading', on);
    form.setAttribute('aria-busy', String(on));
    if (submit) submit.disabled = on;
    if (submitLabel) submitLabel.textContent = on ? 'Отправляем…' : submitLabel.dataset.label!;
  }

  // После первой попытки отправки обновляем ошибки по мере исправления
  form.addEventListener('input', () => {
    if (!touched) return;
    const result = opts.validate(collect(form), zonedNow());
    showErrors(result.ok ? {} : result.errors);
  });
  form.addEventListener('change', () => form.dispatchEvent(new Event('input')));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.classList.contains('is-loading')) return;
    touched = true;
    setNotice(null);

    const data = collect(form);
    const result = opts.validate(data, zonedNow());
    if (!result.ok) {
      showErrors(result.errors);
      focusFirstError();
      return;
    }
    showErrors({});
    setLoading(true);

    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        opts.onSuccess(String(body.id), data);
        return;
      }
      if (res.status === 422 && body.errors) {
        showErrors(body.errors);
        focusFirstError();
        return;
      }
      setNotice(MESSAGES[body.error] ?? MESSAGES.unknown);
      notice?.focus();
    } catch {
      setNotice(MESSAGES.network);
      notice?.focus();
    } finally {
      setLoading(false);
    }
  });
}

/** «24 октября, суббота» для экрана подтверждения */
export function humanDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
