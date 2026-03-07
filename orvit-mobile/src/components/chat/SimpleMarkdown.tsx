import React from "react";
import { View, Text } from "react-native";
import { fonts } from "@/lib/fonts";

/**
 * Lightweight inline markdown renderer for bot messages.
 * Supports: **bold**, *italic*, `code`, - bullet lists, numbered lists.
 * No external dependencies.
 */

interface Props {
  content: string;
  textColor: string;
  codeColor: string;
  codeBg: string;
  fontSize?: number;
  lineHeight?: number;
}

function parseInline(text: string, textColor: string, codeColor: string, codeBg: string, fontSize: number) {
  const parts: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // **bold**
      parts.push(
        <Text key={key++} style={{ fontFamily: fonts.bold, fontWeight: "700" }}>
          {match[2]}
        </Text>
      );
    } else if (match[3]) {
      // *italic*
      parts.push(
        <Text key={key++} style={{ fontStyle: "italic" }}>
          {match[3]}
        </Text>
      );
    } else if (match[4]) {
      // `code`
      parts.push(
        <Text
          key={key++}
          style={{
            fontFamily: fonts.monoMedium,
            fontSize: fontSize - 1,
            color: codeColor,
            backgroundColor: codeBg,
            borderRadius: 3,
            paddingHorizontal: 3,
          }}
        >
          {match[4]}
        </Text>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function SimpleMarkdown({
  content,
  textColor,
  codeColor,
  codeBg,
  fontSize = 13.5,
  lineHeight = 19,
}: Props) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listCounter = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line = paragraph break
    if (!trimmed) {
      elements.push(<View key={`sp-${i}`} style={{ height: 6 }} />);
      listCounter = 0;
      continue;
    }

    // Bullet list: - or *
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      elements.push(
        <View key={`li-${i}`} style={{ flexDirection: "row", paddingLeft: 4, marginVertical: 1 }}>
          <Text
            style={{
              fontSize,
              lineHeight,
              color: textColor,
              fontFamily: fonts.regular,
              width: 16,
            }}
          >
            {"\u2022"}
          </Text>
          <Text
            style={{
              flex: 1,
              fontSize,
              lineHeight,
              color: textColor,
              fontFamily: fonts.regular,
              letterSpacing: -0.135,
            }}
          >
            {parseInline(bulletMatch[1], textColor, codeColor, codeBg, fontSize)}
          </Text>
        </View>
      );
      continue;
    }

    // Numbered list: 1. 2. etc
    const numMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);
    if (numMatch) {
      listCounter++;
      elements.push(
        <View key={`nl-${i}`} style={{ flexDirection: "row", paddingLeft: 4, marginVertical: 1 }}>
          <Text
            style={{
              fontSize,
              lineHeight,
              color: textColor,
              fontFamily: fonts.medium,
              width: 20,
            }}
          >
            {listCounter}.
          </Text>
          <Text
            style={{
              flex: 1,
              fontSize,
              lineHeight,
              color: textColor,
              fontFamily: fonts.regular,
              letterSpacing: -0.135,
            }}
          >
            {parseInline(numMatch[2], textColor, codeColor, codeBg, fontSize)}
          </Text>
        </View>
      );
      continue;
    }

    // Regular text line
    listCounter = 0;
    elements.push(
      <Text
        key={`t-${i}`}
        style={{
          fontSize,
          lineHeight,
          color: textColor,
          fontFamily: fonts.regular,
          letterSpacing: -0.135,
        }}
      >
        {parseInline(trimmed, textColor, codeColor, codeBg, fontSize)}
      </Text>
    );
  }

  return <View>{elements}</View>;
}

export default React.memo(SimpleMarkdown);
