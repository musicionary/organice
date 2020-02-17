import _ from 'lodash';
import { fromJS } from 'immutable';

import { shouldRenderPlanningItem } from './org_utils';
import { renderAsText, timestampDuration } from './timestamps';

const linkPartToRawText = linkPart => {
  if (!!linkPart.getIn(['contents', 'title'])) {
    return `[[${linkPart.getIn(['contents', 'uri'])}][${linkPart.getIn(['contents', 'title'])}]]`;
  } else {
    return `[[${linkPart.getIn(['contents', 'uri'])}]]`;
  }
};

const formattedAttributedStringText = parts => {
  return parts
    .map(part => {
      switch (part.get('type')) {
        case 'text':
          return part.get('contents');
        case 'link':
          if (part.getIn(['contents', 'title'])) {
            return part.getIn(['contents', 'title']);
          } else {
            return part.getIn(['contents', 'uri']);
          }
        case 'table':
          return '';
        default:
          return '';
      }
    })
    .join('');
};

const tablePartToRawText = tablePart => {
  const rowHeights = tablePart
    .get('contents')
    .map(row =>
      Math.max(
        ...row.get('contents').map(cell => (_.countBy(cell.get('rawContents'))['\n'] || 0) + 1)
      )
    )
    .toJS();

  const numColumns = tablePart.getIn(['contents', 0, 'contents']).size;
  const columnWidths = _.times(numColumns).map(columnIndex =>
    Math.max(
      ...tablePart.get('contents').map(row => {
        const content = row.getIn(['contents', columnIndex, 'contents']);
        const formattedText = formattedAttributedStringText(content);
        const lineLengths = formattedText.split('\n').map(line => line.trim().length);
        return Math.max(...lineLengths);
      })
    )
  );

  const rowStrings = _.dropRight(
    _.flatten(
      tablePart
        .get('contents')
        .map((row, rowIndex) => {
          const rowHeight = rowHeights[rowIndex];

          const contentRows = _.times(rowHeight)
            .map(lineIndex =>
              row
                .get('contents')
                .map((cell, columnIndex) => {
                  const content = cell.get('contents');
                  const formattedText = formattedAttributedStringText(content);
                  const formattedLineLengths = formattedText
                    .split('\n')
                    .map(line => line.trim().length);
                  const line = (cell.get('rawContents').split('\n')[lineIndex] || '').trim();

                  const padCount = columnWidths[columnIndex] - formattedLineLengths[lineIndex];

                  return line + ' '.repeat(padCount);
                })
                .toJS()
                .join(' | ')
            )
            .map(contentRow => `| ${contentRow} |`);

          const separator =
            '|' + columnWidths.map(columnWidth => '-'.repeat(columnWidth + 2)).join('+') + '|';

          return contentRows.concat(separator);
        })
        .toJS()
    )
  );

  return rowStrings.join('\n');
};

const listPartToRawText = listPart => {
  const bulletCharacter = listPart.get('bulletCharacter');

  let previousNumber = 0;
  return listPart
    .get('items')
    .map(item => {
      const optionalLeadingSpace = !listPart.get('isOrdered') && bulletCharacter === '*' ? ' ' : '';

      const titleText = attributedStringToRawText(item.get('titleLine'));

      const contentText = attributedStringToRawText(item.get('contents'));
      const indentedContentText = contentText
        .split('\n')
        .map(line => (!!line.trim() ? `${optionalLeadingSpace}  ${line}` : ''))
        .join('\n');

      let listItemText = null;
      if (listPart.get('isOrdered')) {
        let number = ++previousNumber;
        let forceNumber = item.get('forceNumber');
        if (!!forceNumber) {
          number = forceNumber;
          previousNumber = number;
        }

        listItemText = `${number}${listPart.get('numberTerminatorCharacter')}`;

        if (!!forceNumber) {
          listItemText += ` [@${forceNumber}]`;
        }

        if (item.get('isCheckbox')) {
          const stateCharacter = {
            checked: 'X',
            unchecked: ' ',
            partial: '-',
          }[item.get('checkboxState')];

          listItemText += ` [${stateCharacter}]`;
        }

        listItemText += ` ${titleText}`;
      } else {
        listItemText = `${optionalLeadingSpace}${bulletCharacter}`;

        if (item.get('isCheckbox')) {
          const stateCharacter = {
            checked: 'X',
            unchecked: ' ',
            partial: '-',
          }[item.get('checkboxState')];

          listItemText += ` [${stateCharacter}]`;
        }

        listItemText += ` ${titleText}`;
      }

      if (!!contentText) {
        listItemText += `\n${indentedContentText}`;
      }

      return listItemText;
    })
    .join('\n');
};

const timestampPartToRawText = part => {
  let text = renderAsText(part.get('firstTimestamp'));
  if (part.get('secondTimestamp')) {
    text += `--${renderAsText(part.get('secondTimestamp'))}`;
  }

  return text;
};

export const attributedStringToRawText = parts => {
  if (!parts) {
    return '';
  }

  const prevPartTypes = parts.map(part => part.get('type')).unshift(null);

  return parts
    .zip(prevPartTypes)
    .map(([part, prevPartType]) => {
      let text = '';
      switch (part.get('type')) {
        case 'text':
          text = part.get('contents');
          break;
        case 'link':
          text = linkPartToRawText(part);
          break;
        case 'fraction-cookie':
          text = `[${part.getIn(['fraction', 0]) || ''}/${part.getIn(['fraction', 1]) || ''}]`;
          break;
        case 'percentage-cookie':
          text = `[${part.get('percentage') || ''}%]`;
          break;
        case 'table':
          text = tablePartToRawText(part);
          break;
        case 'list':
          text = listPartToRawText(part);
          break;
        case 'timestamp':
          text = timestampPartToRawText(part);
          break;
        case 'url':
        case 'www-url':
        case 'e-mail':
        case 'phone-number':
          text = part.get('content');
          break;
        default:
          console.error(
            `Unknown attributed string part type in attributedStringToRawText: ${part.get('type')}`
          );
      }

      const optionalNewlinePrefix = ['list', 'table'].includes(prevPartType) ? '\n' : '';
      return optionalNewlinePrefix + text;
    })
    .join('');
};

// Takes a plain JS object
export const generateTitleLine = (header, includeStars) => {
  let contents = '';
  if (includeStars) contents += '*'.repeat(header.nestingLevel);

  if (header.titleLine.todoKeyword) {
    contents += ` ${header.titleLine.todoKeyword}`;
  }
  contents += ` ${header.titleLine.rawTitle}`;

  if (header.titleLine.tags.length) {
    contents += `:${header.titleLine.tags.filter(tag => !!tag).join(':')}:`;
  }

  if (!includeStars) contents = contents.substring(1);
  return contents;
};

export const exportOrg = (headers, todoKeywordSets, fileConfigLines, linesBeforeHeadings) => {
  let configContent = '';

  if (fileConfigLines.size > 0) {
    configContent = fileConfigLines.join('\n') + '\n';
  }

  if (!todoKeywordSets.get(0).get('default')) {
    configContent =
      configContent +
      todoKeywordSets
        .map(todoKeywordSet => {
          return todoKeywordSet.get('configLine');
        })
        .join('\n') +
      '\n';
  }

  if (linesBeforeHeadings.size > 0) {
    configContent = configContent + linesBeforeHeadings.join('\n');
  }

  if (configContent.length > 0) {
    configContent = configContent + '\n';
  }

  const headerContent = headers.map(x => createRawDescriptionText(x, true)).join('');

  return configContent + headerContent;
};

export const createRawDescriptionText = (header, includeTitle) => {
  // To simplify access to properties:
  header = header.toJS();

  // Pad things like planning items and tables appropriately
  // considering the nestingLevel of the header.
  const indentation = ' '.repeat(header.nestingLevel + 1);
  let contents = '';

  if (includeTitle) {
    contents += '*'.repeat(header.nestingLevel);
    if (header.titleLine.todoKeyword) {
      contents += ` ${header.titleLine.todoKeyword}`;
    }
    contents += ` ${header.titleLine.rawTitle}`;
    if (header.titleLine.tags.length) {
      contents += `:${header.titleLine.tags.filter(tag => !!tag).join(':')}:`;
    }
    contents += '\n'; // Newline after title line
  }

  // Special case: do not render planning items that are normal active timestamps
  const planningItemsToRender = header.planningItems.filter(shouldRenderPlanningItem);
  if (planningItemsToRender.length) {
    const planningItemsContent = planningItemsToRender
      .map(planningItem => {
        const timestampString = renderAsText(fromJS(planningItem.timestamp));
        return `${planningItem.type}: ${timestampString}`;
      })
      .join(' ')
      .trimRight();
    contents += `${indentation}${planningItemsContent}\n`;
  }

  if (header.propertyListItems.length) {
    const propertyListItemsContent = header.propertyListItems
      .map(propertyListItem => {
        return `${indentation}:${propertyListItem.property}: ${attributedStringToRawText(
          fromJS(propertyListItem.value)
        )}`;
      })
      .join('\n');
    contents += `${indentation}:PROPERTIES:\n`;
    contents += `${propertyListItemsContent}\n`;
    contents += `${indentation}:END:\n`;
  }

  if (header.logBookEntries.length) {
    const logBookEntriesContent = header.logBookEntries
      .map(entry => {
        if (entry.raw !== undefined) {
          return entry.raw ? `${indentation}${entry.raw}` : '';
        } else if (entry.end === null) {
          return `${indentation}CLOCK: ${renderAsText(fromJS(entry.start))}`;
        } else {
          return `${indentation}CLOCK: ${renderAsText(fromJS(entry.start))}--${renderAsText(
            fromJS(entry.end)
          )} => ${timestampDuration(fromJS(entry.start), fromJS(entry.end))}`;
        }
      })
      .join('\n')
      .trimRight();
    contents += `${indentation}:LOGBOOK:\n`;
    contents += `${logBookEntriesContent}\n`;
    contents += `${indentation}:END:\n`;
  }

  // A newline character belongs to its line, not to the next line.
  // Unless rawDescription === '', it must have a trailing newline character.
  let fixedRawDescription = header.rawDescription;
  if (header.rawDescription.match(/[^\n]$/)) fixedRawDescription = header.rawDescription + '\n';
  contents += fixedRawDescription;

  return contents;
};
