export interface TiptapEditorProps {
  initialContent?: string;
  onChange?: (content: string) => void;
  editable?: boolean;
  className?: string;
  placeholder?: string;
  onSave?: () => Promise<void>;
} 