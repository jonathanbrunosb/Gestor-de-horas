import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Button } from '../ui/Button';

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
}

export function UploadDropzone({ onFilesSelected, accept = '.csv,.txt,.pdf,.json' }: UploadDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) onFilesSelected(files);
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length) onFilesSelected(files);
    event.target.value = '';
  }

  return (
    <div
      className={`drop-zone ${dragOver ? 'dragover' : ''}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div>
        <div className="drop-icon">
          <svg width="22" height="22" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 9.5V1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4.5 4.5L7.5 1.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 10.5v1.5A1.5 1.5 0 003.5 13.5h8a1.5 1.5 0 001.5-1.5v-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p style={{ fontWeight: 600, marginBottom: 4 }}>Arraste o arquivo do cartão-ponto aqui</p>
        <p className="small-text" style={{ marginBottom: 14 }}>
          Formatos aceitos: CSV, TXT, PDF ou JSON (base exportada)
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
        >
          Selecionar arquivo
        </Button>
        <input ref={inputRef} type="file" accept={accept} multiple hidden onChange={handleInputChange} />
      </div>
    </div>
  );
}
