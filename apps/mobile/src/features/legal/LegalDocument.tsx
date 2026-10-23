import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { legalDocuments } from './documents.generated';

export type LegalDoc = keyof typeof legalDocuments;

/** Renders the small Markdown subset the legal documents use: headings, bullets, **bold**, paragraphs. */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const blocks = legalDocuments[doc].split(/\n{2,}/);
  return (
    <View style={styles.wrap}>
      {blocks.map((block, i) => {
        if (block.startsWith('# ')) {
          return (
            <Text key={i} variant="headlineSmall" style={styles.bold} accessibilityRole="header">
              {block.slice(2)}
            </Text>
          );
        }
        if (block.startsWith('## ')) {
          return (
            <Text key={i} variant="titleMedium" style={[styles.bold, styles.h2]} accessibilityRole="header">
              {block.slice(3)}
            </Text>
          );
        }
        if (block.startsWith('- ')) {
          return (
            <View key={i} style={styles.list}>
              {block.split('\n').map((line, j) => (
                <Text key={j} variant="bodyLarge">
                  • <Inline text={line.replace(/^- /, '')} />
                </Text>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} variant="bodyLarge">
            <Inline text={block} />
          </Text>
        );
      })}
    </View>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
        part.startsWith('**') ? (
          <Text key={i} style={styles.bold}>
            {part.slice(2, -2)}
          </Text>
        ) : (
          part
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  bold: { fontWeight: '700' },
  h2: { marginTop: 8 },
  list: { gap: 6 },
});
