import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  UIManager,
  Share,
} from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { type ShareIntentFile, useShareIntentContext } from 'expo-share-intent';
import * as Linking from 'expo-linking';
import {
  FileAudio,
  FileText,
  Image as ImageIcon,
  Link2,
  Mic2,
  RotateCcw,
  Share2,
  Square,
  Volume2,
  Video,
} from 'lucide-react-native';
import {
  extractNaverBlogText,
  extractWebsiteText,
  isNaverBlogUrl,
  safeFileName,
  saveNaverDebugSnapshot,
} from '../services/content-extraction';
import {
  fileCategory,
  formatBytes,
  isReadableTextFile,
  readTextFromFileUri,
} from '../services/file-reader';
import { createSpeechController } from '../services/speech-controller';

const SAMPLE_TEXT =
  'Drive Reader turns text, shared links, and text files into spoken audio so you can keep your eyes on the road.';
type FileCard = {
  file: ShareIntentFile;
  preview?: string;
  note: string;
};

type InputMode = 'file' | 'naver' | 'website';

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function categoryIcon(file: ShareIntentFile) {
  if (file.mimeType.startsWith('image/')) return ImageIcon;
  if (file.mimeType.startsWith('video/')) return Video;
  if (file.mimeType.startsWith('audio/')) return FileAudio;
  return FileText;
}

function InputModeButton({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.modeChip,
        active && styles.modeChipActive,
        pressed && styles.buttonPressed,
      ]}>
      <Text style={[styles.modeChipLabel, active && styles.modeChipLabelActive]}>{label}</Text>
    </Pressable>
  );
}



function ActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  testID,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        pressed && styles.buttonPressed,
      ]}>
      <View style={styles.buttonIcon}>{icon}</View>
      <Text style={[styles.buttonLabel, variant !== 'primary' && styles.buttonLabelDark]}>
        {label}
      </Text>
    </Pressable>
  );
}

function StatPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.statPill}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FileRow({
  card,
  dark,
}: {
  card: FileCard;
  dark: boolean;
}) {
  const Icon = categoryIcon(card.file);

  return (
    <View style={[styles.fileRow, dark && styles.fileRowDark]}>
      <View style={styles.fileRowTop}>
        <View style={styles.fileRowIconWrap}>
          <Icon size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
        </View>
        <View style={styles.fileRowMeta}>
          <Text style={[styles.fileRowTitle, dark && styles.textLight]} numberOfLines={1}>
            {card.file.fileName}
          </Text>
          <Text style={[styles.fileRowSub, dark && styles.textMuted]}>
            {fileCategory(card.file)} 夷?{card.file.mimeType} 夷?{formatBytes(card.file.size)}
          </Text>
        </View>
      </View>

      <Text style={[styles.filePath, dark && styles.textMuted]} numberOfLines={2}>
        {card.file.path}
      </Text>

      {card.preview ? (
        <View style={styles.previewBlock}>
          <Text style={[styles.previewLabel, dark && styles.textSoft]}>Preview</Text>
          <Text style={[styles.previewText, dark && styles.textLight]} numberOfLines={7}>
            {card.preview}
          </Text>
        </View>
      ) : (
        <Text style={[styles.fileNote, dark && styles.textMuted]}>{card.note}</Text>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const dark = false;
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  const [text, setText] = useState(SAMPLE_TEXT);
  const [manualFileUri, setManualFileUri] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<ShareIntentFile | null>(null);
  const [sharedFiles, setSharedFiles] = useState<FileCard[]>([]);
  const [status, setStatus] = useState('Ready for text, file URIs, deep links, and share intents.');
  const [isBusy, setIsBusy] = useState(false);
  const [isEditTextExpanded, setIsEditTextExpanded] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const speechControllerRef = useRef<ReturnType<typeof createSpeechController> | null>(null);

  const [blogSnapshot, setBlogSnapshot] = useState<{
    title: string;
    text: string;
    uri: string;
  } | null>(null);
  const previewSnippet = text
    .split(/\r?\n/)
    .slice(0, 10)
    .join('\n')
    .trim();

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  if (!speechControllerRef.current) {
    speechControllerRef.current = createSpeechController({
      onStatus: setStatus,
      onError: (message) => {
        setStatus(message);
        Alert.alert('Drive Reader', message);
      },
    });
  }

  useEffect(() => {
    let alive = true;

    const syncFromUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (!initialUrl || !alive) {
        return;
      }

      const parsed = Linking.parse(initialUrl);
      const incomingText = firstValue(parsed.queryParams?.text as string | string[] | undefined);
      const incomingFile = firstValue(parsed.queryParams?.file as string | string[] | undefined);
      const incomingUrl = firstValue(parsed.queryParams?.url as string | string[] | undefined);

      if (incomingText) {
        setText(incomingText);
        setStatus('Loaded text from the deep link.');
        return;
      }

      if (incomingUrl) {
        setText(incomingUrl);
        setStatus('Loaded URL from the deep link.');
        return;
      }

      if (incomingFile) {
        setManualFileUri(incomingFile);
        setStatus('Loaded file URI from the deep link.');
      }
    };

    syncFromUrl();

    const subscription = Linking.addEventListener('url', ({ url }) => {
      const parsed = Linking.parse(url);
      const incomingText = firstValue(parsed.queryParams?.text as string | string[] | undefined);
      const incomingFile = firstValue(parsed.queryParams?.file as string | string[] | undefined);
      const incomingUrl = firstValue(parsed.queryParams?.url as string | string[] | undefined);

      if (incomingText) {
        setText(incomingText);
        setStatus('Loaded text from an incoming deep link.');
        return;
      }

      if (incomingUrl) {
        setText(incomingUrl);
        setStatus('Loaded URL from an incoming deep link.');
        return;
      }

      if (incomingFile) {
        setManualFileUri(incomingFile);
        setStatus('Loaded file URI from an incoming deep link.');
      }
    });

    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const consumeShareIntent = async () => {
      if (!hasShareIntent || !shareIntent) {
        return;
      }

      setIsBusy(true);
      try {
        if (shareIntent.files?.length) {
          const cards: FileCard[] = [];
          const textFiles = shareIntent.files.filter((file) => isReadableTextFile(file));

          for (const file of shareIntent.files) {
            if (!alive) {
              return;
            }

            let preview: string | undefined;
            let note = `${fileCategory(file)} shared.`;

            if (isReadableTextFile(file)) {
              try {
                preview = await readTextFromFileUri(file.path);
                note = `Text content loaded from ${file.fileName}.`;
              } catch (error) {
                note =
                  error instanceof Error
                    ? `Could not read text content: ${error.message}`
                    : 'Could not read text content.';
              }
            }

            cards.push({ file, preview, note });
          }

          setSharedFiles(cards);
          setSelectedFile(cards[0]?.file ?? null);
          setManualFileUri(cards[0]?.file.path ?? '');

          if (textFiles.length > 0) {
            const firstTextPreview = cards.find((card) => card.preview)?.preview ?? '';
            if (firstTextPreview) {
              setText(firstTextPreview);
            }
            setStatus(`Loaded ${textFiles.length} text file(s) from sharing.`);
          } else if (shareIntent.text) {
            setText(shareIntent.text);
            setStatus('Loaded shared text.');
          } else if (shareIntent.webUrl) {
            setText(shareIntent.webUrl);
            setStatus('Loaded a shared web link.');
          } else {
            setStatus(`Received ${shareIntent.files.length} shared file(s).`);
          }
        } else if (shareIntent.webUrl) {
          setSharedFiles([]);
          setSelectedFile(null);
          setManualFileUri('');
          setText(shareIntent.webUrl);
          setStatus('Loaded a shared web link.');
        } else if (shareIntent.text) {
          setSharedFiles([]);
          setSelectedFile(null);
          setManualFileUri('');
          setText(shareIntent.text);
          setStatus('Loaded shared text.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to read the shared file.';
        setStatus(message);
        Alert.alert('Drive Reader', message);
      } finally {
        if (alive) {
          setIsBusy(false);
          resetShareIntent(true);
        }
      }
    };

    consumeShareIntent();

    return () => {
      alive = false;
    };
  }, [hasShareIntent, resetShareIntent, shareIntent]);

  const speakText = async () => {
    await speechControllerRef.current?.speak(text);
  };

  const stopSpeech = async () => {
    await speechControllerRef.current?.stop();
  };

  const loadFile = async () => {
    const uri = manualFileUri.trim();
    if (!uri) {
      setStatus('Paste a local file path or file:// URI first.');
      return;
    }

    setIsBusy(true);
    try {
      const content = await readTextFromFileUri(uri);
      const file: ShareIntentFile = {
        fileName: uri.split(/[\\/]/).pop() ?? 'file',
        mimeType: 'text/plain',
        path: uri,
        size: content.length,
        width: null,
        height: null,
        duration: null,
      };

      setSharedFiles([{ file, preview: content, note: 'Loaded from the local file system.' }]);
      setSelectedFile(file);
      setText(content);
      setStatus('Loaded file from the local file system.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read the file.';
      setStatus(message);
      Alert.alert('Drive Reader', message);
    } finally {
      setIsBusy(false);
    }
  };

  const resetAll = () => {
    setText(SAMPLE_TEXT);
    setManualFileUri('');
    setSelectedFile(null);
    setSharedFiles([]);
    setStatus('Reset to the sample text.');
  };

  const clearTextOnly = () => {
    setText('');
    setStatus('Cleared the text field.');
  };

  const toggleEditTextExpansion = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Keyboard.dismiss();
    setIsEditTextExpanded((value) => !value);
  };

  const openAppUrl = async () => {
    const url = Linking.createURL('');
    try {
      await Linking.openURL(url);
    } catch {
      setStatus(`App URL is ${url}`);
    }
  };

  const saveBlogSnapshot = async () => {
    const sourceText = blogSnapshot?.text ?? text;
    const sourceTitle = blogSnapshot?.title ?? 'drive-reader-blog';
    const trimmed = sourceText.trim();

    if (!trimmed) {
      setStatus('Nothing to save yet.');
      return;
    }

    setIsBusy(true);
    try {
      const snapshotName = `${safeFileName(sourceTitle)}-${Date.now()}.txt`;
      const snapshotFile = new File(Paths.cache, snapshotName);
      snapshotFile.write(trimmed);

      const file: ShareIntentFile = {
        fileName: snapshotName,
        mimeType: 'text/plain',
        path: snapshotFile.uri,
        size: trimmed.length,
        width: null,
        height: null,
        duration: null,
      };

      setBlogSnapshot({
        title: sourceTitle,
        text: trimmed,
        uri: snapshotFile.uri,
      });
      setSharedFiles([
        {
          file,
          preview: trimmed,
          note: 'Saved blog snapshot.',
        },
      ]);
      setSelectedFile(file);
      setManualFileUri(snapshotFile.uri);
      setStatus(`Saved blog snapshot as ${snapshotName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save the blog snapshot.';
      setStatus(message);
      Alert.alert('Drive Reader', message);
    } finally {
      setIsBusy(false);
    }
  };

  const shareBlogSnapshot = async () => {
    const sourceText = blogSnapshot?.text ?? text;
    const sourceTitle = blogSnapshot?.title ?? 'Drive Reader';
    const trimmed = sourceText.trim();

    if (!trimmed) {
      setStatus('Nothing to share yet.');
      return;
    }

    try {
      await Share.share({
        title: sourceTitle,
        message: trimmed,
      });
      setStatus('Shared the extracted blog text.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to share the blog text.';
      setStatus(message);
      Alert.alert('Drive Reader', message);
    }
  };

  const loadBlogText = async () => {
    const url = blogUrl.trim();
    if (!url) {
      setStatus('Enter a Naver blog URL first.');
      return;
    }

    if (!isNaverBlogUrl(url)) {
      setStatus('Please enter a Naver blog URL.');
      return;
    }

    setIsBusy(true);
      try {
        const result = await extractNaverBlogText(url);
        const textSnapshotName = `${safeFileName(result.title)}-${Date.now()}.txt`;
        const snapshotFile = new File(Paths.cache, textSnapshotName);
        snapshotFile.write(result.text);

      const file: ShareIntentFile = {
        fileName: textSnapshotName,
        mimeType: 'text/plain',
        path: snapshotFile.uri,
        size: result.text.length,
        width: null,
        height: null,
        duration: null,
      };

      setSharedFiles([
        {
          file,
          preview: result.text,
          note: `Extracted from ${url}`,
        },
      ]);
      setSelectedFile(file);
      setManualFileUri(snapshotFile.uri);
        setBlogSnapshot({
          title: result.title,
          text: result.text,
          uri: snapshotFile.uri,
        });
        setText(result.text);
        setStatus(`Loaded blog body from ${result.title}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to extract the blog text.';
        if (/Could not resolve the blog content/i.test(message)) {
          const debugSnapshot = await saveNaverDebugSnapshot(url, message);
          if (debugSnapshot) {
            setStatus(`Extraction failed. Saved debug snapshot to cache.`);
          } else {
            setStatus(message);
          }
        } else {
          setStatus(message);
        }
        Alert.alert('Drive Reader', message);
      } finally {
        setIsBusy(false);
    }
  };

  const pickTextFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/plain', 'text/*', '.txt', '.md'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        setStatus('File selection canceled.');
        return;
      }

      const asset = result.assets[0];
      const mimeType = asset.mimeType ?? 'text/plain';
      if (!mimeType.startsWith('text/') && !/\.(txt|md|csv|json|log|xml|html?|yaml|yml|rtf)$/i.test(asset.name)) {
        setStatus('Select a text file such as .txt, .md, or .csv.');
        return;
      }

      const content = await readTextFromFileUri(asset.uri);
      const file: ShareIntentFile = {
        fileName: asset.name,
        mimeType,
        path: asset.uri,
        size: asset.size ?? content.length,
        width: null,
        height: null,
        duration: null,
      };

      setSharedFiles([{ file, preview: content, note: 'Picked from the system file chooser.' }]);
      setSelectedFile(file);
      setManualFileUri(asset.uri);
      setText(content);
      setStatus(`Loaded ${asset.name} from the system file chooser.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to pick a file.';
      setStatus(message);
      Alert.alert('Drive Reader', message);
    }
  };

  const loadWebsiteText = async () => {
    const url = websiteUrl.trim();
    if (!url) {
      setStatus('Enter a website URL first.');
      return;
    }

    setIsBusy(true);
    try {
      const { normalizedUrl, text: textSnapshot, title } = await extractWebsiteText(url);

      const snapshotName = `${safeFileName(title)}-${Date.now()}.txt`;
      const snapshotFile = new File(Paths.cache, snapshotName);
      snapshotFile.write(textSnapshot);

      const file: ShareIntentFile = {
        fileName: snapshotName,
        mimeType: 'text/plain',
        path: snapshotFile.uri,
        size: textSnapshot.length,
        width: null,
        height: null,
        duration: null,
      };

      setSharedFiles([
        {
          file,
          preview: textSnapshot,
          note: `Extracted from ${normalizedUrl}`,
        },
      ]);
      setSelectedFile(file);
      setManualFileUri(snapshotFile.uri);
      setText(textSnapshot);
      setBlogSnapshot({
        title,
        text: textSnapshot,
        uri: snapshotFile.uri,
      });
      setStatus(`Loaded website body from ${title}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to extract the website text.';
      setStatus(message);
      Alert.alert('Drive Reader', message);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <View style={styles.brandMark}>
              <Mic2 color="#0F172A" size={22} strokeWidth={2.5} />
            </View>
            <View style={styles.brandCopy}>
              <Text style={[styles.kicker, dark && styles.textSoft]}>Drive Reader</Text>
              <Text style={[styles.heroTitle, dark && styles.textLight]}>
                Load and read.
              </Text>
            </View>
            <Link href="/workflow" asChild>
              <Pressable
                testID="help-link"
                style={({ pressed }) => [styles.helpPill, pressed && styles.buttonPressed]}>
                <Text style={styles.helpPillText}>How to use</Text>
              </Pressable>
            </Link>
          </View>
          <View style={styles.statsRow}>
            <StatPill icon={<Volume2 size={14} color="#0F172A" strokeWidth={2.5} />} label="TTS" />
            <StatPill
              icon={<FileText size={14} color="#0F172A" strokeWidth={2.5} />}
              label="Files"
            />
            <StatPill
              icon={<Share2 size={14} color="#0F172A" strokeWidth={2.5} />}
              label="Flow"
            />
          </View>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <FileText size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Put data in</Text>
            </View>
            {isBusy ? <ActivityIndicator color={dark ? '#E2E8F0' : '#0F172A'} /> : null}
          </View>

          <Text style={[styles.helperText, dark && styles.textMuted]}>
            Choose one input type first. The matching card appears below.
          </Text>

          <View style={styles.modeRow}>
            <InputModeButton
              label="Internal file"
              active={inputMode === 'file'}
              onPress={() => setInputMode('file')}
              testID="input-mode-file"
            />
            <InputModeButton
              label="Naver blog"
              active={inputMode === 'naver'}
              onPress={() => setInputMode('naver')}
              testID="input-mode-naver"
            />
            <InputModeButton
              label="Website"
              active={inputMode === 'website'}
              onPress={() => setInputMode('website')}
              testID="input-mode-website"
            />
          </View>

          {inputMode === 'file' ? (
            <View style={styles.inputPanel} testID="input-panel-file">
              <Text style={[styles.inputPanelTitle, dark && styles.textLight]}>Internal file</Text>
              <Text style={[styles.helperText, dark && styles.textMuted]}>
                Pick a local file, paste a file path, or open a deep link.
              </Text>
              <TextInput
                value={manualFileUri}
                onChangeText={setManualFileUri}
                testID="file-uri-input"
                placeholder="file:///path/to/book.txt"
                placeholderTextColor={dark ? '#64748B' : '#94A3B8'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.singleLineInput, dark && styles.textInputDark]}
              />
              <View style={styles.fileReaderActions}>
                <ActionButton
                  label="Read file"
                  icon={<FileAudio size={16} color="#FFFFFF" />}
                  onPress={loadFile}
                />
                <ActionButton
                  label="Choose file"
                  icon={<FileText size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={pickTextFile}
                  variant="secondary"
                />
                <ActionButton
                  label="App URL"
                  icon={<Link2 size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={openAppUrl}
                  variant="ghost"
                />
              </View>
            </View>
          ) : null}

          {inputMode === 'naver' ? (
            <View style={styles.inputPanel} testID="input-panel-naver">
              <Text style={[styles.inputPanelTitle, dark && styles.textLight]}>Naver blog</Text>
              <Text style={[styles.helperText, dark && styles.textMuted]}>
                Paste a Naver blog URL, extract the post body, then save or share it.
              </Text>
              <TextInput
                value={blogUrl}
                onChangeText={setBlogUrl}
                testID="naver-url-input"
                placeholder="https://blog.naver.com/..."
                placeholderTextColor={dark ? '#64748B' : '#94A3B8'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.singleLineInput, dark && styles.textInputDark]}
              />
              <View style={styles.fileReaderActions}>
                <ActionButton
                  label="Reset URL"
                  icon={<Square size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={() => setBlogUrl('')}
                  variant="secondary"
                />
                <ActionButton
                  label="Extract"
                  icon={<Link2 size={16} color="#FFFFFF" />}
                  onPress={loadBlogText}
                />
                <ActionButton
                  label="Example"
                  icon={<RotateCcw size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={() =>
                    setBlogUrl('https://m.blog.naver.com/PostView.naver?blogId=YOUR_ID&logNo=POST_NO')
                  }
                  variant="secondary"
                />
                <ActionButton
                  label="Save"
                  icon={<Square size={16} color="#FFFFFF" />}
                  onPress={saveBlogSnapshot}
                />
                <ActionButton
                  label="Share"
                  icon={<Share2 size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={shareBlogSnapshot}
                  variant="ghost"
                />
              </View>
            </View>
          ) : null}

          {inputMode === 'website' ? (
            <View style={styles.inputPanel} testID="input-panel-website">
              <Text style={[styles.inputPanelTitle, dark && styles.textLight]}>Website</Text>
              <Text style={[styles.helperText, dark && styles.textMuted]}>
                Paste a normal website URL. Drive Reader will extract readable text from the page.
              </Text>
              <TextInput
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
                testID="website-url-input"
                placeholder="https://example.com/article"
                placeholderTextColor={dark ? '#64748B' : '#94A3B8'}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.singleLineInput, dark && styles.textInputDark]}
              />
              <View style={styles.fileReaderActions}>
                <ActionButton
                  label="Read website"
                  icon={<Link2 size={16} color="#FFFFFF" />}
                  onPress={loadWebsiteText}
                />
                <ActionButton
                  label="Clear"
                  icon={<Square size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={() => setWebsiteUrl('')}
                  variant="secondary"
                />
                <ActionButton
                  label="Save"
                  icon={<Square size={16} color="#FFFFFF" />}
                  onPress={saveBlogSnapshot}
                />
                <ActionButton
                  label="Share"
                  icon={<Share2 size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                  onPress={shareBlogSnapshot}
                  variant="ghost"
                />
              </View>
            </View>
          ) : null}
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Volume2 size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Confirm it</Text>
            </View>
          </View>

          <View
            testID="preview-panel"
            style={[styles.readerBox, dark && styles.readerBoxDark]}>
            <View style={styles.readerHeader}>
              <Text style={[styles.readerLabel, dark && styles.textSoft]}>Reader</Text>
              <Text style={[styles.readerHint, dark && styles.textMuted]}>
                Swipe inside this box to scroll long text.
              </Text>
            </View>
            <ScrollView
              testID="preview-scroll"
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={styles.readerScroll}
              contentContainerStyle={styles.readerScrollContent}>
              <Text style={[styles.readerText, dark && styles.textLight]} selectable>
                {text || 'No text loaded yet.'}
              </Text>
            </ScrollView>
          </View>

          <View
            testID="edit-body"
            style={[styles.editBody, !isEditTextExpanded && styles.editBodyCollapsed]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Square size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
                <Text style={[styles.sectionTitle, dark && styles.textLight]}>Edit text</Text>
              </View>
              <Pressable
                onPress={toggleEditTextExpansion}
                testID="edit-toggle"
                style={({ pressed }) => [styles.expandButton, pressed && styles.buttonPressed]}>
                <Text style={styles.expandButtonLabel}>
                  {isEditTextExpanded ? 'Close' : 'Edit'}
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.helperText, dark && styles.textMuted]}>
              Open this only when you need to fix or replace the text.
            </Text>

            {isEditTextExpanded ? (
              <>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  testID="confirm-text-input"
                  multiline
                  scrollEnabled
                  textAlignVertical="top"
                  placeholder="Paste text here or load it from a share intent."
                  placeholderTextColor={dark ? '#64748B' : '#94A3B8'}
                  style={[styles.textInput, dark && styles.textInputDark]}
                />

                <View style={styles.actionsWrap}>
                  <ActionButton
                    label="Load sample"
                    icon={<RotateCcw size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                    onPress={() => setText(SAMPLE_TEXT)}
                    variant="secondary"
                    testID="load-sample-button"
                  />
                  <ActionButton
                    label="Clear"
                    icon={<Square size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
                    onPress={clearTextOnly}
                    variant="ghost"
                    testID="clear-button"
                  />
                  <ActionButton
                    label="Reset"
                    icon={<Square size={16} color="#FFFFFF" />}
                    onPress={resetAll}
                    testID="reset-button"
                  />
                </View>
              </>
            ) : (
              <View style={styles.editSummary}>
                <Text style={[styles.editSummaryLabel, dark && styles.textSoft]}>Current text</Text>
                <Text style={[styles.editSummaryText, dark && styles.textLight]} numberOfLines={2}>
                  {previewSnippet || 'No text loaded yet.'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.card, dark && styles.cardDark]}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Link2 size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
              <Text style={[styles.sectionTitle, dark && styles.textLight]}>Read it</Text>
            </View>
            {isBusy ? <ActivityIndicator color={dark ? '#E2E8F0' : '#0F172A'} /> : null}
          </View>

          <Text style={[styles.statusText, dark && styles.textMuted]}>{status}</Text>

          <View style={styles.infoRow}>
            <Text style={[styles.metaLabel, dark && styles.textSoft]}>Share intent</Text>
            <Text style={[styles.metaValue, dark && styles.textLight]}>
              {hasShareIntent
                ? sharedFiles.length
                  ? `${sharedFiles.length} file(s)`
                  : shareIntent?.webUrl
                    ? 'web URL'
                    : shareIntent?.text
                      ? 'text'
                      : 'available'
                : 'none'}
            </Text>
          </View>

          {selectedFile ? (
            <View style={styles.filePreviewBox}>
              <View style={styles.filePreviewHead}>
                <FileAudio size={18} color={dark ? '#E2E8F0' : '#0F172A'} />
                <Text style={[styles.filePreviewTitle, dark && styles.textLight]}>
                  {selectedFile.fileName}
                </Text>
              </View>
              <Text style={[styles.fileMeta, dark && styles.textMuted]}>
                {selectedFile.mimeType} 夷?{formatBytes(selectedFile.size)}
              </Text>
              <Text style={[styles.fileMeta, dark && styles.textMuted]} numberOfLines={2}>
                {selectedFile.path}
              </Text>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <ActionButton
              label="Speak"
              icon={<Mic2 size={16} color="#FFFFFF" />}
              onPress={speakText}
              testID="speak-button"
            />
            <ActionButton
              label="Stop"
              icon={<Square size={16} color={dark ? '#E2E8F0' : '#0F172A'} />}
              onPress={stopSpeech}
              variant="secondary"
              testID="stop-button"
            />
          </View>
        </View>

        <View style={[styles.footerCard, dark && styles.cardDark]}>
          <Text style={[styles.footerTitle, dark && styles.textLight]}>Quick test links</Text>
          <Text style={[styles.footerText, dark && styles.textMuted]}>
            `drivereader://?text=Hello` loads text. `drivereader://?file=file:///...` points at a
            file. Use the `Speak` and `Stop` buttons in `Read it` after you confirm the text.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 18,
    paddingBottom: 36,
    gap: 14,
  },
  hero: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brandMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  brandCopy: {
    flex: 1,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: '#0F172A',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  helpPill: {
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  helpPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  expandButton: {
    borderRadius: 999,
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  expandButtonLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  modeChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  modeChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  modeChipLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  modeChipLabelActive: {
    color: '#FFFFFF',
  },
  inputPanel: {
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  inputPanelTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  statIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  statLabel: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  card: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardDark: {
    backgroundColor: '#0C1828',
    borderColor: 'rgba(148, 163, 184, 0.12)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statusText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  metaValue: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '700',
    textAlign: 'right',
    flex: 1,
  },
  filePreviewBox: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F9FAFB',
    gap: 8,
  },
  filePreviewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  filePreviewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    flex: 1,
  },
  fileMeta: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  sharedList: {
    gap: 12,
  },
  fileRow: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#F9FAFB',
    gap: 10,
  },
  fileRowDark: {
    backgroundColor: '#F9FAFB',
  },
  fileRowTop: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  fileRowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  fileRowMeta: {
    flex: 1,
    gap: 2,
  },
  fileRowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  fileRowSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  filePath: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  fileNote: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  previewBlock: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#F9FAFB',
    gap: 10,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748B',
  },
  previewText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0F172A',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  inputStack: {
    gap: 16,
  },
  inputStackItem: {
    gap: 12,
  },
  fileReaderActions: {
    flexDirection: 'column',
    gap: 12,
  },
  actionsWrap: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  button: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  buttonPrimary: {
    backgroundColor: '#0F172A',
  },
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
  },
  buttonGhost: {
    backgroundColor: '#FFFFFF',
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  buttonIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  buttonLabelDark: {
    color: '#0F172A',
  },
  textInput: {
    minHeight: 210,
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  textInputDark: {
    backgroundColor: '#081423',
    color: '#E2E8F0',
    borderColor: 'rgba(148, 163, 184, 0.16)',
  },
  editBody: {
    gap: 12,
  },
  editBodyCollapsed: {
    gap: 8,
  },
  editSummary: {
    gap: 6,
    paddingVertical: 2,
  },
  editSummaryLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748B',
  },
  editSummaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#0F172A',
  },
  readerBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    backgroundColor: '#F8FAFC',
    padding: 16,
    gap: 10,
    height: 220,
    overflow: 'hidden',
  },
  readerBoxDark: {
    backgroundColor: '#081423',
    borderColor: 'rgba(148, 163, 184, 0.16)',
  },
  readerHeader: {
    gap: 4,
  },
  readerLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#64748B',
  },
  readerHint: {
    fontSize: 12,
    color: '#475569',
  },
  readerScroll: {
    flex: 1,
  },
  readerScrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingBottom: 6,
  },
  readerText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#0F172A',
  },
  helperText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 18,
  },
  sourceChipList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sourceChip: {
    minWidth: 160,
    flexGrow: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  sourceChipKind: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#0F172A',
  },
  sourceChipLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sourceChipHint: {
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  singleLineInput: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  footerCard: {
    borderRadius: 24,
    padding: 16,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
  },
  footerTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  footerText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#475569',
  },
  textLight: {
    color: '#E2E8F0',
  },
  textMuted: {
    color: '#94A3B8',
  },
  textSoft: {
    color: '#CBD5E1',
  },
});



