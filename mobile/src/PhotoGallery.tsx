import Icon from 'react-native-vector-icons/MaterialIcons';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';

interface FileItem {
  fileName: string;
  url: string;
  metadata: {
    batchid: string;
    ai_short?: string;
    ai_long?: string;
  };
}

interface Batch {
  batchId: string;
  ai_long?: string;
  files: FileItem[];
}

const { width } = Dimensions.get('window');
const IMAGE_SIZE = (width - 40) / 3;

const PhotoGallery = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);

  const fetchImages = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        'https://chmuraprojekt.azurewebsites.net/api/files'
      );
      const data = await response.json();

      const batchMap: Record<string, Batch> = {};
      data.files.forEach((file: FileItem) => {
        const batchId = file.metadata.batchid || 'unknown';
        if (!batchMap[batchId]) {
          batchMap[batchId] = {
            batchId,
            ai_long: file.metadata.ai_long,
            files: [],
          };
        }
        batchMap[batchId].files.push(file);
        if (!batchMap[batchId].ai_long && file.metadata.ai_long) {
          batchMap[batchId].ai_long = file.metadata.ai_long;
        }
      });

      setBatches(Object.values(batchMap));
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error fetching images:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchImages();
  };

  if (!selectedBatch) {
    if (loading) {
      return (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#aaaaaa" />
        </View>
      );
    }

    return (
      <FlatList
        style={{ backgroundColor: '#2b2b2b' }}
        data={batches}
        keyExtractor={(item) => item.batchId}
        onRefresh={onRefresh}
        refreshing={refreshing}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.batchTile}
            onPress={() => setSelectedBatch(item)}
          >
            <Text style={styles.batchTitle}>{item.batchId}</Text>
            {item.ai_long ? (
              <Text style={styles.aiDescription} numberOfLines={3}>
                {item.ai_long}
              </Text>
            ) : null}
            <View style={styles.thumbnailRow}>
              {item.files.slice(0, 3).map((file) => (
                <Image
                  key={file.fileName}
                  source={{ uri: file.url }}
                  style={styles.thumbnail}
                />
              ))}
            </View>
          </TouchableOpacity>
        )}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#2b2b2b', padding: 10 }}>
      <TouchableOpacity
        onPress={() => setSelectedBatch(null)}
        style={styles.backButtonContainer}
      >
        <Text style={styles.backButtonText}>
        ⬅️  Back to batches
        </Text>
      </TouchableOpacity>
      <Text style={styles.batchTitle}>{selectedBatch.batchId}</Text>
      {selectedBatch.ai_long ? (
        <Text style={styles.aiDescription}>{selectedBatch.ai_long}</Text>
      ) : null}
      <ScrollView>
        {chunkArray(selectedBatch.files, 3).map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((file) => (
              <Image
                key={file.fileName}
                source={{ uri: file.url }}
                style={styles.image}
              />
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#444',
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  backButtonText: {
    color: '#00aced',
    fontSize: 14,
    fontWeight: '600',
  },
  batchTile: {
    backgroundColor: '#3a3a3a',
    margin: 10,
    padding: 10,
    borderRadius: 10,
  },
  batchTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
    marginBottom: 5,
  },
  aiDescription: {
    fontSize: 13,
    color: '#cccccc',
    marginBottom: 5,
  },
  thumbnailRow: {
    flexDirection: 'row',
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 5,
    marginRight: 5,
  },
  backButton: {
    color: '#00aced',
    marginBottom: 10,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  image: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 10,
    marginRight: 5,
  },
});

export default PhotoGallery;
