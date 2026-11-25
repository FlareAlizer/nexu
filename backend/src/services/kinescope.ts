// Kinescope: embed + трекинг % просмотра через player API (фронт шлёт события).
// Сверить эндпоинты с docs.kinescope.io при реализации. Защита от скачивания — в настройках Kinescope.

/** URL для iframe-плеера. */
export function embedUrl(videoId: string): string {
  return `https://kinescope.io/embed/${videoId}`;
}
