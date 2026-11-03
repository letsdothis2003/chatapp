# chatapp

## File compression and feedback

Files larger than 2.5 MB are compressed locally before sending. Images are converted to WebP; other file types use GZIP and receive a `.gz` filename when that produces a smaller file. Compressed files must be 20 MB or smaller to send. If compression fails, does not reduce the size, or stays over the size limit, the UI explains why. Users can also choose to send the original.

File selection, active optimization, completion, and send outcomes have distinct visual status indicators, a progress bar, workflow steps, brief blue ripple/flash, and short audio cues by default. The compress button is gray when compression is unavailable and bright blue when a smaller, sendable result is ready. Status messages are announced to assistive technology, keyboard focus is visible, and motion effects respect the system reduced-motion setting.